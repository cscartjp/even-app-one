import { moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line } from 'even-toolkit/types'
import type { State } from './reducer'

/** グラスで選べる固定質問（Phase 1 のフォールバック）。スマホ入力は §18 step2 で前倒し可能。 */
export interface PresetQuestion {
  label: string
  text: string
}

/** idle メニュー先頭に置く音声入力エントリのラベル（Task 3.4.2）。 */
export const VOICE_LABEL = '🎤 話す'

/** 画面のスナップショット = 状態機械の State + 静的なプリセット一覧。 */
export type Snapshot = State & { presets: PresetQuestion[] }

/** 画面操作の副作用。AppGlasses が React 側の実体（dispatch + マイク/fetch）を渡す。 */
export interface Ctx {
  /** プリセット質問を送る（idle）。 */
  ask: (q: PresetQuestion) => void
  /** 録音開始（idle→recording / review からの録り直し）。 */
  startRecording: () => void
  /** 録音停止して文字起こしへ（recording→transcribing）。 */
  stopRecording: () => void
  /** 録音/文字起こしを中止して idle へ。 */
  cancelRecording: () => void
  /** 文字起こし結果を Hermes へ送信（review→thinking）。 */
  send: () => void
  /** 録り直し（review→recording）。 */
  retake: () => void
  nextPage: () => void
  prevPage: () => void
  back: () => void
  exit: () => void
}

const HINT_IDLE = '↕選択  タップ送信  ダブルタップ終了'
const HINT_ANSWER = 'タップ:次  ↕:ページ  ダブルタップ:戻る'

/**
 * G2 Hermes の単一画面。phase に応じて
 * 「質問選択 / 録音 / 文字起こし中 / 確認 / Thinking / 回答 / エラー」を出し分ける。
 * 入力は even-toolkit の 3 アクション（↕=HIGHLIGHT_MOVE / 単押し=SELECT / ダブルタップ=GO_BACK）。
 */
export const hermesScreen: GlassScreen<Snapshot, Ctx> = {
  display(s, nav) {
    const header = [line('G2 Hermes'), line('', 'separator')]

    if (s.phase === 'recording') {
      return {
        lines: [
          ...header,
          line('  REC ●  録音中'),
          line('  タップで停止 / 30秒で自動停止', 'meta'),
          line(s.notice ? `  ${s.notice}` : '', 'meta'),
        ],
      }
    }

    if (s.phase === 'transcribing') {
      return {
        lines: [...header, line(''), line('  文字起こし中…')],
      }
    }

    if (s.phase === 'review') {
      return {
        lines: [
          ...header,
          line(s.transcript ?? ''),
          line(''),
          line('  タップ:送信  ダブルタップ:録り直し', 'meta'),
        ],
      }
    }

    if (s.phase === 'thinking') {
      return {
        lines: [
          ...header,
          line(''),
          line('  Thinking…'),
          line(
            s.askingLabel ? `  「${s.askingLabel}」を問い合わせ中` : '',
            'meta',
          ),
        ],
      }
    }

    if (s.phase === 'error') {
      return {
        lines: [
          ...header,
          line(`  エラー: ${s.errorMsg ?? '不明'}`),
          line('  タップで戻る', 'meta'),
        ],
      }
    }

    if (s.phase === 'answer') {
      const total = s.pages.length
      const page = s.pages[s.pageIndex] ?? ''
      return {
        lines: [
          ...header,
          line(page),
          line(''),
          line(`${s.pageIndex + 1}/${total}  ${HINT_ANSWER}`, 'meta'),
        ],
      }
    }

    // idle: 先頭に音声入力、続けてプリセット質問（フォールバック）を highlight 付きで並べる
    return {
      lines: [
        ...header,
        line(VOICE_LABEL, 'normal', nav.highlightedIndex === 0),
        ...s.presets.map((p, i) =>
          line(p.label, 'normal', nav.highlightedIndex === i + 1),
        ),
        line(HINT_IDLE, 'meta'),
      ],
    }
  },

  action(action, nav, s, ctx) {
    if (s.phase === 'idle') {
      if (action.type === 'HIGHLIGHT_MOVE') {
        return {
          ...nav,
          highlightedIndex: moveHighlight(
            nav.highlightedIndex,
            action.direction,
            // 先頭=音声(0) + プリセット(1..presets.length)。最大 index = presets.length
            s.presets.length,
          ),
        }
      }
      if (action.type === 'SELECT_HIGHLIGHTED') {
        if (nav.highlightedIndex === 0) {
          ctx.startRecording()
          return nav
        }
        const q = s.presets[nav.highlightedIndex - 1]
        if (q) ctx.ask(q)
        return nav
      }
      // GO_BACK: idle でのダブルタップは終了
      ctx.exit()
      return nav
    }

    if (s.phase === 'recording') {
      if (action.type === 'SELECT_HIGHLIGHTED') ctx.stopRecording()
      else if (action.type === 'GO_BACK') ctx.cancelRecording()
      // HIGHLIGHT_MOVE は無視
      return nav
    }

    if (s.phase === 'transcribing') {
      // 文字起こし中。ダブルタップで中止できる（長い STT の逃げ道）。タップは無視
      if (action.type === 'GO_BACK') ctx.cancelRecording()
      return nav
    }

    if (s.phase === 'review') {
      if (action.type === 'SELECT_HIGHLIGHTED') ctx.send()
      else if (action.type === 'GO_BACK') ctx.retake()
      // HIGHLIGHT_MOVE は無視
      return nav
    }

    if (s.phase === 'answer') {
      if (action.type === 'SELECT_HIGHLIGHTED') {
        ctx.nextPage()
        return nav
      }
      if (action.type === 'HIGHLIGHT_MOVE') {
        if (action.direction === 'down') ctx.nextPage()
        else ctx.prevPage()
        return nav
      }
      // GO_BACK: 回答からダブルタップで質問選択へ戻る
      ctx.back()
      return nav
    }

    if (s.phase === 'error') {
      // どの操作でも質問選択へ戻す
      if (action.type !== 'HIGHLIGHT_MOVE') ctx.back()
      return nav
    }

    // thinking: 問い合わせ中は入力を無視
    return nav
  },
}
