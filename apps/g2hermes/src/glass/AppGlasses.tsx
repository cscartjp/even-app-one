import { useGlasses } from 'even-toolkit/useGlasses'
import { type Dispatch, useCallback, useEffect, useMemo, useRef } from 'react'
import { askBridge, transcribe } from '../api/bridgeClient'
import { encodeWav, isTooShort } from '../audio/capture'
import { requestExit } from '../even/bridge'
import { type LifecycleHandle, watchLifecycle } from '../even/lifecycle'
import { type MicSession, startMicCapture } from '../even/mic-source'
import type { Event, State } from './reducer'
import {
  type Ctx,
  hermesScreen,
  type PresetQuestion,
  type Snapshot,
} from './screen'

/** 会話セッション。固定 ID にすると Bridge 側で会話が継続する。 */
const SESSION_ID = 'g2-main'

interface AppGlassesProps {
  /** 会話状態（正本は App の useReducer）。 */
  state: State
  dispatch: Dispatch<Event>
  /** idle に併存させるプリセット質問（App が storage から読み、Companion 編集と共有）。 */
  presets: PresetQuestion[]
}

/**
 * グラス表示のブリッジ。状態（reducer）と presets は App が正本として持ち、ここへ props で渡る。
 * マイク開閉・文字起こし・Hermes 問い合わせの副作用を AppGlasses が実行する。
 * useGlasses が 100ms ポーリングで snapshot 参照の変化を検知して再描画するため、
 * dispatch で state が変わればグラス表示も追従する。
 */
export function AppGlasses({ state, dispatch, presets }: AppGlassesProps) {
  // 最新 state を ref で参照する（lifecycle / 非同期コールバックの stale クロージャ回避）。
  const stateRef = useRef(state)
  stateRef.current = state

  // マイクは端末 1 つの toggle なので、起動/停止を 1 本の promise chain で直列化する
  // （交錯すると古い停止が新しい録音のマイクを閉じる。probe 実装から踏襲）。
  const micChainRef = useRef<Promise<void>>(Promise.resolve())
  const enqueueMic = useCallback((task: () => Promise<void>) => {
    const next = micChainRef.current.then(task, task)
    micChainRef.current = next.catch(() => {})
    return next
  }, [])
  const micSessionRef = useRef<MicSession | null>(null)
  // 世代トークン。BACK/録り直し/新規送信のたびに +1 し、古い録音/文字起こし/問い合わせの
  // 結果が新しい画面に紛れ込むのを防ぐ。
  const genRef = useRef(0)
  // 30s 自動停止から最新の停止処理を呼ぶための間接参照（startMic↔handleStop の循環回避）。
  const handleStopRef = useRef<() => void>(() => {})
  // 録音中フラグ（同期）。タップ停止と 30s 自動停止が同時に来ても停止処理を1回に絞る
  // （二重停止だと後発が空サンプルを掴み録音をやり直してしまう）。
  const recordingActiveRef = useRef(false)

  // マイクを開く（直列）。bridge 不在/権限拒否なら error へ倒す。
  const startMic = useCallback(
    () =>
      enqueueMic(async () => {
        const prev = micSessionRef.current
        micSessionRef.current = null
        if (prev) await prev.stop()
        try {
          micSessionRef.current = await startMicCapture({
            onMaxDuration: () => handleStopRef.current(),
          })
        } catch {
          dispatch({ type: 'FAIL', error: 'マイクを使えません' })
        }
      }),
    [enqueueMic, dispatch],
  )

  // マイクを閉じ（直列）、録音した全サンプルを返す。
  const stopMic = useCallback(async () => {
    let samples: Float32Array = new Float32Array(0)
    await enqueueMic(async () => {
      const s = micSessionRef.current
      micSessionRef.current = null
      if (s) samples = await s.stop()
    })
    return samples
  }, [enqueueMic])

  // Hermes へ問い合わせる（プリセット質問・音声送信の共通処理）。
  const runAsk = useCallback(
    async (label: string, text: string) => {
      const gen = ++genRef.current
      dispatch({ type: 'ASK', label })
      const outcome = await askBridge(SESSION_ID, text, 'short')
      if (gen !== genRef.current) return
      if (outcome.ok) {
        const { pages, text: ans } = outcome.result
        const next =
          pages.length > 0 ? pages : ans ? [ans] : ['(回答がありません)']
        dispatch({ type: 'ANSWERED', pages: next })
      } else {
        dispatch({ type: 'FAIL', error: outcome.error })
      }
    },
    [dispatch],
  )

  // 録音停止 → 空/極短を弾く → 文字起こし → review（tap と 30s 自動停止の両方から呼ぶ）。
  const handleStop = useCallback(async () => {
    // 二重停止ガード（同期）。最初の1回だけが録音を消費する。
    if (!recordingActiveRef.current) return
    recordingActiveRef.current = false
    const gen = genRef.current
    const samples = await stopMic()
    if (gen !== genRef.current) return
    if (isTooShort(samples)) {
      dispatch({ type: 'REC_TOO_SHORT' })
      recordingActiveRef.current = true
      startMic()
      return
    }
    dispatch({ type: 'STOP_RECORDING' })
    const outcome = await transcribe(encodeWav(samples))
    if (gen !== genRef.current) return
    if (!outcome.ok) {
      dispatch({ type: 'FAIL', error: outcome.error })
      return
    }
    const text = outcome.result.text.trim()
    if (!text) {
      // 無音などで空テキストなら録り直しへ
      dispatch({ type: 'REC_TOO_SHORT' })
      recordingActiveRef.current = true
      startMic()
      return
    }
    dispatch({ type: 'TRANSCRIBED', text })
  }, [stopMic, startMic, dispatch])
  handleStopRef.current = () => {
    void handleStop()
  }

  // 録音開始（idle からの開始 / review からの録り直しで共用）。
  const beginRecording = useCallback(() => {
    genRef.current += 1
    recordingActiveRef.current = true
    dispatch({ type: 'START_RECORDING' })
    startMic()
  }, [startMic, dispatch])

  // 録音/文字起こし/回答からの中止・戻る（マイクを閉じて idle へ）。
  const back = useCallback(() => {
    genRef.current += 1
    recordingActiveRef.current = false
    void stopMic()
    dispatch({ type: 'BACK' })
  }, [stopMic, dispatch])

  const ask = useCallback(
    (q: PresetQuestion) => {
      void runAsk(q.label, q.text)
    },
    [runAsk],
  )
  const stopRecording = useCallback(() => {
    void handleStop()
  }, [handleStop])
  const send = useCallback(() => {
    const t = stateRef.current.transcript ?? ''
    if (t.trim()) void runAsk(t, t)
  }, [runAsk])
  const nextPage = useCallback(
    () => dispatch({ type: 'NEXT_PAGE' }),
    [dispatch],
  )
  const prevPage = useCallback(
    () => dispatch({ type: 'PREV_PAGE' }),
    [dispatch],
  )
  const exit = useCallback(() => {
    void requestExit()
  }, [])

  // 前面/背面でのマイク制御（spec §4.5 / DoD）。
  // 背面化したら録音を中止し idle へ戻す（マイクを閉じる）。背面中の録音バッファは保持できず、
  // そのまま復帰すると「背面後に録れた分だけ」を黙って送る部分欠落になり得るため、
  // バッファを引きずらず明示キャンセルする（安全側・Copilot 指摘）。
  // 復帰（前面）時は idle に戻っているので何もしない（再録音はユーザーのタップで開始）。
  useEffect(() => {
    let handle: LifecycleHandle | null = null
    let disposed = false
    void watchLifecycle({
      onBackground: () => {
        if (stateRef.current.phase === 'recording') back()
      },
      onForeground: () => {},
    }).then((h) => {
      if (disposed) h.stop()
      else handle = h
    })
    return () => {
      disposed = true
      handle?.stop()
      // アンマウント時（終了等）も必ずマイクを閉じる
      void stopMic()
    }
  }, [back, stopMic])

  const ctxRef = useRef<Ctx>({
    ask,
    startRecording: beginRecording,
    stopRecording,
    cancelRecording: back,
    send,
    retake: beginRecording,
    nextPage,
    prevPage,
    back,
    exit,
  })
  ctxRef.current = {
    ask,
    startRecording: beginRecording,
    stopRecording,
    cancelRecording: back,
    send,
    retake: beginRecording,
    nextPage,
    prevPage,
    back,
    exit,
  }

  // 毎レンダーで新しい snapshot を作り ref に格納する（参照変化＝再描画トリガ）。
  const snapshotRef = useMemo(() => ({ current: null as Snapshot | null }), [])
  snapshotRef.current = { ...state, presets }

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
