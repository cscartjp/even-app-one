import type { Dispatch } from 'react'
import { type AskOutcome, askBridge } from '../api/bridgeClient'
import type { Event } from './reducer'

/** 会話セッション。固定 ID にすると Bridge 側で会話が継続する（previous_response_id）。 */
export const ASK_SESSION_ID = 'g2-main'

type AskFn = (
  sessionId: string,
  text: string,
  mode?: 'short' | 'normal',
) => Promise<AskOutcome>

export interface RunAskOptions {
  /** テスト用に askBridge を差し替える。既定は実 Bridge クライアント。 */
  ask?: AskFn
  /**
   * 世代ガード。問い合わせ完了時に false なら結果 dispatch を捨てる（古い回答の紛れ込み防止）。
   * グラスの録音世代トークンと共有するため注入式にする。未指定なら常に反映。
   */
  isCurrent?: () => boolean
  sessionId?: string
}

/**
 * Hermes へ問い合わせる共通処理（プリセット質問・音声送信・スマホ自由入力で共有）。
 * `dispatch` で `ASK`→(`ANSWERED`|`FAIL`) を流すだけで、新しいネットワーク経路は作らない
 * （Phase 1 の `askBridge` をそのまま使う / 仕様書の単一 ask 経路）。
 */
export async function runAsk(
  dispatch: Dispatch<Event>,
  label: string,
  text: string,
  options: RunAskOptions = {},
): Promise<void> {
  const { ask = askBridge, isCurrent, sessionId = ASK_SESSION_ID } = options
  dispatch({ type: 'ASK', label })
  const outcome = await ask(sessionId, text, 'short')
  if (isCurrent && !isCurrent()) return
  if (outcome.ok) {
    const { pages, text: ans } = outcome.result
    const next = pages.length > 0 ? pages : ans ? [ans] : ['(回答がありません)']
    dispatch({ type: 'ANSWERED', pages: next })
  } else {
    dispatch({ type: 'FAIL', error: outcome.error })
  }
}
