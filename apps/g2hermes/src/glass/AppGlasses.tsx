import { useGlasses } from 'even-toolkit/useGlasses'
import { useCallback, useMemo, useRef, useState } from 'react'
import { askBridge } from '../api/bridgeClient'
import { requestExit } from '../even/bridge'
import {
  type MicProbeHandle,
  type MicProbeStats,
  startMicProbe,
} from '../even/mic-probe'
import {
  type Ctx,
  hermesScreen,
  type Phase,
  type PresetQuestion,
  type Snapshot,
} from './screen'

/** 会話セッション。固定 ID にすると Bridge 側で会話が継続する。 */
const SESSION_ID = 'g2-main'

// Phase 1 はグラスで固定プリセットから質問を選ぶ（キーボード無し）。
// スマホ側テキスト入力は仕様書 §18 step2 で前倒し可能。
const PRESETS: PresetQuestion[] = [
  { label: '自己紹介', text: '短く自己紹介して' },
  { label: '今できること', text: 'あなたが今できることを3つ、短く教えて' },
  { label: '豆知識', text: '面白い豆知識を1つ、短く教えて' },
  { label: '今日の日付', text: '今日の日付を教えて' },
]

/**
 * グラス表示のブリッジ。React state（phase/pages/...）を snapshot にまとめ useGlasses へ渡す。
 * useGlasses は 100ms ポーリングで snapshot の参照変化を検知して再描画するため、
 * state を更新すれば idle→Thinking→回答ページの遷移がそのままグラスに反映される。
 */
export function AppGlasses() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [pages, setPages] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [askingLabel, setAskingLabel] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Task 3.0 マイク診断の live 結果（probe phase 中のみ非 null）
  const [probeStats, setProbeStats] = useState<MicProbeStats | null>(null)

  // ページ送りは setState の関数更新内で最新の pages 長が要るので ref で参照する
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  // 起動中のマイク probe ハンドル（停止対象）
  const probeHandleRef = useRef<MicProbeHandle | null>(null)
  // マイクは global（audioControl は端末 1 つの toggle）なので、起動/停止を 1 本の
  // promise chain で直列化する。これをしないと、起動待ち中に再操作したとき古い probe の
  // 停止 audioControl(false) が新しい probe のマイクを閉じ、gating が false negative に
  // なり得る（Codex 指摘）。chain で順序を固定すれば mic on/off が交錯しない。
  const micChainRef = useRef<Promise<void>>(Promise.resolve())
  const enqueueMic = useCallback((task: () => Promise<void>) => {
    const next = micChainRef.current.then(task, task)
    micChainRef.current = next.catch(() => {})
    return next
  }, [])
  // 既存 probe を直列に停止する（mic off）
  const stopProbe = useCallback(
    () =>
      enqueueMic(async () => {
        const handle = probeHandleRef.current
        probeHandleRef.current = null
        if (handle) await handle.stop()
      }),
    [enqueueMic],
  )

  const ask = useCallback(async (q: PresetQuestion) => {
    setAskingLabel(q.label)
    setErrorMsg(null)
    setPhase('thinking')
    const outcome = await askBridge(SESSION_ID, q.text, 'short')
    if (outcome.ok) {
      const { pages: resPages, text } = outcome.result
      // pages 優先、無ければ text、どちらも空なら空ページにしない
      const next =
        resPages.length > 0 ? resPages : text ? [text] : ['(回答がありません)']
      setPages(next)
      setPageIndex(0)
      setPhase('answer')
    } else {
      setErrorMsg(outcome.error)
      setPhase('error')
    }
  }, [])

  const nextPage = useCallback(() => {
    const n = pagesRef.current.length
    if (n > 0) setPageIndex((i) => (i + 1) % n)
  }, [])
  const prevPage = useCallback(() => {
    const n = pagesRef.current.length
    if (n > 0) setPageIndex((i) => (i - 1 + n) % n)
  }, [])
  const back = useCallback(() => {
    // probe 中なら直列 chain でマイクを閉じる（UI は即 idle へ）
    void stopProbe()
    setProbeStats(null)
    setPages([])
    setPageIndex(0)
    setAskingLabel(null)
    setErrorMsg(null)
    setPhase('idle')
  }, [stopProbe])
  const exit = useCallback(() => {
    void requestExit()
  }, [])

  // Task 3.0 gating spike: マイク診断を開始する（暫定）
  const probe = useCallback(() => {
    setProbeStats(null)
    setPhase('probe')
    void enqueueMic(async () => {
      // 念のため既存 probe を閉じてから開始（重なり防止）
      const prev = probeHandleRef.current
      probeHandleRef.current = null
      if (prev) await prev.stop()
      probeHandleRef.current = await startMicProbe(setProbeStats)
    })
  }, [enqueueMic])

  const ctxRef = useRef<Ctx>({ ask, probe, nextPage, prevPage, back, exit })
  ctxRef.current = { ask, probe, nextPage, prevPage, back, exit }

  // 毎レンダーで新しい snapshot を作り ref に格納する（参照変化＝再描画トリガ）
  const snapshotRef = useMemo(() => ({ current: null as Snapshot | null }), [])
  snapshotRef.current = {
    phase,
    presets: PRESETS,
    askingLabel,
    pages,
    pageIndex,
    errorMsg,
    probeStats,
  }

  const getSnapshot = useCallback(
    // biome-ignore lint/style/noNonNullAssertion: 直前のレンダーで必ず代入済み
    () => snapshotRef.current!,
    [snapshotRef],
  )

  useGlasses<Snapshot>({
    getSnapshot,
    toDisplayData: (s, nav) => hermesScreen.display(s, nav),
    onGlassAction: (action, nav, s) =>
      hermesScreen.action(action, nav, s, ctxRef.current),
    deriveScreen: () => 'home',
    appName: 'G2 HERMES',
    getPageMode: () => 'home',
    // GO_BACK を自前 action で扱う（answer→idle の「戻る」 / idle→終了）
    shutdownOnHomeBack: false,
  })

  return null
}
