import { Button, Card, Textarea } from 'even-toolkit/web'
import { useState } from 'react'
import type { State } from '../glass/reducer'

interface AskBoxProps {
  /** 会話状態（正本は App の reducer）。送信中/回答/エラーをここから読みミラー表示する。 */
  state: State
  /** 自由入力テキストを Hermes へ送る（App が runAsk で Phase 1 askBridge 経由）。 */
  onAsk: (text: string) => void
}

/** 回答ミラー（同一 state を購読し「送信中…/回答/エラー」を出す）。phase 以外では何も出さない。 */
function AskMirror({ state }: { state: State }) {
  if (state.phase === 'thinking') {
    return <p className="text-[15px] text-text-dim">送信中…</p>
  }
  if (state.phase === 'answer') {
    return (
      <p className="whitespace-pre-wrap text-[15px] text-text">
        {state.pages.join('\n')}
      </p>
    )
  }
  if (state.phase === 'error') {
    return (
      <p className="text-[15px] text-negative">
        エラー: {state.errorMsg ?? '不明'}
      </p>
    )
  }
  return null
}

/**
 * 送信を許可する phase。会話が動いていない安全な状態だけに絞る。
 * recording/transcribing/review はグラスの音声フローが共有 state・マイク/文字起こしを
 * 進めている最中で、ここで `ASK` を割り込ませると後続の `STOP_RECORDING`/`TRANSCRIBED` が
 * thinking/answer を上書きし、録音も最大時間まで残り得る（Codex 指摘）。thinking は問い合わせ中。
 */
const READY_PHASES: ReadonlyArray<State['phase']> = ['idle', 'answer', 'error']

/**
 * スマホからその場で質問を送る入力欄。グラスを覗かずに送信→回答確認できる。
 * 送信は App 経由で Phase 1 の askBridge に流れ（新経路なし）、回答は同じ reducer state を
 * 購読してグラス表示とミラーする。グラスの音声フロー中・問い合わせ中は競合を避け送信を無効化。
 */
export function AskBox({ state, onAsk }: AskBoxProps) {
  const [text, setText] = useState('')
  const ready = READY_PHASES.includes(state.phase)
  const trimmed = text.trim()
  const canSend = trimmed.length > 0 && ready

  const handleSend = () => {
    if (!canSend) return
    onAsk(trimmed)
  }

  return (
    <Card>
      <div className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="その場で質問を送る…"
          rows={2}
        />
        <Button onClick={handleSend} disabled={!canSend}>
          送信
        </Button>
        {!ready && state.phase !== 'thinking' && (
          <p className="text-[13px] text-text-dim">
            グラスで音声操作中は送信できません。
          </p>
        )}
        <AskMirror state={state} />
      </div>
    </Card>
  )
}
