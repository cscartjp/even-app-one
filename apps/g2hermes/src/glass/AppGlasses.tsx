import { useGlasses } from 'even-toolkit/useGlasses'
import { useCallback, useMemo, useRef, useState } from 'react'
import { askBridge } from '../api/bridgeClient'
import { requestExit } from '../even/bridge'
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

  // ページ送りは setState の関数更新内で最新の pages 長が要るので ref で参照する
  const pagesRef = useRef(pages)
  pagesRef.current = pages

  const ask = useCallback(async (q: PresetQuestion) => {
    setAskingLabel(q.label)
    setErrorMsg(null)
    setPhase('thinking')
    const outcome = await askBridge(SESSION_ID, q.text, 'short')
    if (outcome.ok) {
      const next = outcome.result.pages.length
        ? outcome.result.pages
        : [outcome.result.text]
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
    setPages([])
    setPageIndex(0)
    setAskingLabel(null)
    setErrorMsg(null)
    setPhase('idle')
  }, [])
  const exit = useCallback(() => {
    void requestExit()
  }, [])

  const ctxRef = useRef<Ctx>({ ask, nextPage, prevPage, back, exit })
  ctxRef.current = { ask, nextPage, prevPage, back, exit }

  // 毎レンダーで新しい snapshot を作り ref に格納する（参照変化＝再描画トリガ）
  const snapshotRef = useMemo(() => ({ current: null as Snapshot | null }), [])
  snapshotRef.current = {
    phase,
    presets: PRESETS,
    askingLabel,
    pages,
    pageIndex,
    errorMsg,
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
