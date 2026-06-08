import { moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line } from 'even-toolkit/types'
import type { MicProbeStats } from '../even/mic-probe'

/** グラスで選べる固定質問（Phase 1）。スマホ入力は仕様書 §18 step2 で前倒し可能。 */
export interface PresetQuestion {
  label: string
  text: string
}

/** idle メニューの最後に置く「マイク診断」項目のラベル（Phase 3 / Task 3.0 gating spike・暫定）。 */
export const PROBE_LABEL = '🎤 マイク診断 (Phase 3)'

/**
 * idle→thinking→answer の状態遷移（error は失敗時）。React state が正本。
 * probe は Task 3.0 のマイク診断用の暫定 phase（Task 3.4 で本番の音声入力に置き換える）。
 */
export type Phase = 'idle' | 'thinking' | 'answer' | 'error' | 'probe'

export interface Snapshot {
  phase: Phase
  presets: PresetQuestion[]
  /** thinking/answer 中に表示する、送った質問のラベル */
  askingLabel: string | null
  pages: string[]
  pageIndex: number
  errorMsg: string | null
  /** probe phase 中のマイク診断結果（live 更新） */
  probeStats: MicProbeStats | null
}

/** 画面操作の副作用。AppGlasses が React state 更新として実体を渡す。 */
export interface Ctx {
  ask: (q: PresetQuestion) => void
  /** マイク診断を開始する（Task 3.0 gating spike・暫定） */
  probe: () => void
  nextPage: () => void
  prevPage: () => void
  back: () => void
  exit: () => void
}

const HINT_IDLE = '↕選択  タップで送信  ダブルタップで終了'
const HINT_ANSWER = 'タップ:次  ↕:ページ  ダブルタップ:戻る'

/**
 * G2 Hermes の単一画面。phase に応じて「質問選択 / Thinking / 回答ページ / エラー」を出し分ける。
 * 入力は even-toolkit の 3 アクション（↕=HIGHLIGHT_MOVE / 単押し=SELECT / ダブルタップ=GO_BACK）。
 */
export const hermesScreen: GlassScreen<Snapshot, Ctx> = {
  display(s, nav) {
    const header = [line('G2 Hermes'), line('', 'separator')]

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

    if (s.phase === 'probe') {
      const p = s.probeStats
      const status = p?.note
        ? p.note
        : p?.started
          ? '起動OK・受信待ち'
          : '起動失敗(権限?)'
      const bytes =
        p && p.firstBytes.length > 0 ? `[${p.firstBytes.join(' ')}]` : '-'
      return {
        lines: [
          ...header,
          line('  マイク診断 (Task 3.0)'),
          line(`  audioControl: ${status}`, 'meta'),
          line(`  PCM events: ${p?.events ?? 0}  bytes: ${p?.totalBytes ?? 0}`),
          line(`  first: len=${p?.firstByteLength ?? 0} ${bytes}`, 'meta'),
          line('  タップで停止して戻る', 'meta'),
        ],
      }
    }

    // idle: 質問の選択肢 + 末尾にマイク診断項目を highlight 付きで並べる
    return {
      lines: [
        ...header,
        ...s.presets.map((p, i) =>
          line(p.label, 'normal', i === nav.highlightedIndex),
        ),
        line(PROBE_LABEL, 'normal', nav.highlightedIndex === s.presets.length),
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
            // presets + 末尾のマイク診断項目（index = presets.length）
            s.presets.length,
          ),
        }
      }
      if (action.type === 'SELECT_HIGHLIGHTED') {
        // 末尾はマイク診断、それ以外はプリセット質問
        if (nav.highlightedIndex === s.presets.length) {
          ctx.probe()
          return nav
        }
        const q = s.presets[nav.highlightedIndex]
        if (q) ctx.ask(q)
        return nav
      }
      // GO_BACK: idle でのダブルタップは終了
      ctx.exit()
      return nav
    }

    if (s.phase === 'probe') {
      // どの操作でもマイクを停止して質問選択へ戻す
      if (action.type !== 'HIGHLIGHT_MOVE') ctx.back()
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
