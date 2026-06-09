// G2 Hermes の状態機械（純粋 reducer）。副作用（マイク開閉・fetch）は AppGlasses が
// この遷移結果に応じて実行する。phase 遷移をここに集約してユニットテスト可能にする
// （spec §4.5 / Task 3.4.2）。どの phase でどの event を発火するかは screen.ts の
// action ハンドラがゲートするため、reducer は event 駆動で素直に遷移する。

/** 音声入力フローの状態。idle にプリセット質問（Phase 1）が併存する。 */
export type Phase =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'review'
  | 'thinking'
  | 'answer'
  | 'error'

export interface State {
  phase: Phase
  /** thinking/answer 中に表示する、送った質問のラベル（プリセット名 or 文字起こし文）。 */
  askingLabel: string | null
  /** review 中に表示する文字起こし結果。 */
  transcript: string | null
  pages: string[]
  pageIndex: number
  errorMsg: string | null
  /** recording 中のヒント（空/極短で弾いたときの「もう一度話してください」）。 */
  notice: string | null
  /** 待ち時間スピナーのアニメ frame（thinking/transcribing で TICK 加算・入場で 0）。 */
  frame: number
}

export type Event =
  | { type: 'START_RECORDING' } // idle/review → recording（開始・録り直し）
  | { type: 'REC_TOO_SHORT' } // recording のまま「もう一度話してください」
  | { type: 'STOP_RECORDING' } // recording → transcribing
  | { type: 'TRANSCRIBED'; text: string } // transcribing → review
  | { type: 'ASK'; label: string } // idle(プリセット)/review(送信) → thinking
  | { type: 'ANSWERED'; pages: string[] } // thinking → answer
  | { type: 'NEXT_PAGE' }
  | { type: 'PREV_PAGE' }
  | { type: 'FAIL'; error: string } // 任意 → error
  | { type: 'BACK' } // 任意 → idle へリセット
  | { type: 'TICK' } // 待ち時間スピナーの frame を進める（thinking/transcribing 中のみ発火）

export const initialState: State = {
  phase: 'idle',
  askingLabel: null,
  transcript: null,
  pages: [],
  pageIndex: 0,
  errorMsg: null,
  notice: null,
  frame: 0,
}

export function reduce(state: State, event: Event): State {
  switch (event.type) {
    case 'START_RECORDING':
      return {
        ...state,
        phase: 'recording',
        transcript: null,
        errorMsg: null,
        notice: null,
      }
    case 'REC_TOO_SHORT':
      return { ...state, phase: 'recording', notice: 'もう一度話してください' }
    case 'STOP_RECORDING':
      return { ...state, phase: 'transcribing', notice: null, frame: 0 }
    case 'TRANSCRIBED':
      return { ...state, phase: 'review', transcript: event.text }
    case 'ASK':
      return {
        ...state,
        phase: 'thinking',
        askingLabel: event.label,
        errorMsg: null,
        frame: 0,
      }
    case 'ANSWERED':
      return { ...state, phase: 'answer', pages: event.pages, pageIndex: 0 }
    case 'NEXT_PAGE': {
      const n = state.pages.length
      return n > 0 ? { ...state, pageIndex: (state.pageIndex + 1) % n } : state
    }
    case 'PREV_PAGE': {
      const n = state.pages.length
      return n > 0
        ? { ...state, pageIndex: (state.pageIndex - 1 + n) % n }
        : state
    }
    case 'FAIL':
      return { ...state, phase: 'error', errorMsg: event.error }
    case 'BACK':
      return { ...initialState }
    case 'TICK':
      // 待ち時間 phase のときだけ frame を進める。それ以外は同一参照を返し、
      // useReducer の再レンダー（→ BLE への余計な updateHomeText）を bail out させる
      // （離脱直後の stray TICK を無コスト化・状態機械の不変条件）。
      return state.phase === 'thinking' || state.phase === 'transcribing'
        ? { ...state, frame: state.frame + 1 }
        : state
  }
}
