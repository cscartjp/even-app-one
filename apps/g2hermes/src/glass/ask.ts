import type { Dispatch } from 'react'
import { type AskOutcome, askBridge, playAudio } from '../api/bridgeClient'
import { autoProbeLine } from '../audio/ttsProbe'
import type { Event } from './reducer'

/** 会話セッション。固定 ID にすると Bridge 側で会話が継続する（previous_response_id）。 */
export const ASK_SESSION_ID = 'g2-main'

type AskFn = (
  sessionId: string,
  text: string,
  mode?: 'short' | 'normal',
  tts?: boolean,
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
  /**
   * TTS 実機プローブ（Phase 7）の自動発話フック。回答テキストを受け、ON のとき
   * グラス追記用の verdict 1 行を、OFF（既定）のとき null を返す。既定は env gate 付き
   * 実プローブ（`autoProbeLine`）。テストでは注入して env/window 非依存にする。
   */
  probe?: (answerText: string) => string | null
  /**
   * 音声回答（Phase 8）。設定「音声で回答」が ON のとき true。true のとき ask に tts:true を渡し、
   * 回答に audioUrl があれば再生する。false/未設定なら tts を付けず再生もしない（現行等価）。
   */
  tts?: boolean
  /**
   * 回答音声の再生フック（device-io）。既定は実 `playAudio`。テストでは注入して
   * window/Audio 非依存にし、呼ばれた/呼ばれないの純ロジックを検証する。
   */
  play?: (audioUrl: string) => void
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
  const {
    ask = askBridge,
    isCurrent,
    sessionId = ASK_SESSION_ID,
    probe = autoProbeLine,
    tts = false,
    play = playAudio,
  } = options
  dispatch({ type: 'ASK', label })
  const outcome = await ask(sessionId, text, 'short', tts)
  if (isCurrent && !isCurrent()) return
  if (outcome.ok) {
    const { pages, text: ans, audioUrl } = outcome.result
    const next = pages.length > 0 ? pages : ans ? [ans] : ['(回答がありません)']
    // Phase 7 プローブ: ON のとき verdict 1 行を pages 末尾に追記してグラスに出す。
    // OFF（既定）のとき probe は null を返し、dispatch は現行とバイト等価（完全 no-op）。
    const verdict = probe(ans || next.join(' '))
    dispatch({ type: 'ANSWERED', pages: verdict ? [...next, verdict] : next })
    // Phase 8: 設定 ON（tts）かつ audioUrl 有なら音声再生する。再生は fire-and-forget で
    // 回答表示（上の ANSWERED）を阻害しない（audioUrl が無い＝合成失敗/未要求なら何もしない）。
    // play が同期 throw しても runAsk を reject させない（呼び出し側は void runAsk なので
    // 未処理例外になる・回答表示は既に済んでいる）。握り潰してログのみ（Copilot 指摘）。
    if (tts && audioUrl) {
      try {
        play(audioUrl)
      } catch (e) {
        console.warn('[g2hermes] 音声再生の起動に失敗（無視して継続）', e)
      }
    }
  } else {
    dispatch({ type: 'FAIL', error: outcome.error })
  }
}
