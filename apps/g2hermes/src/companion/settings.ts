/**
 * コンパニオン設定のデータモデル（純粋関数のみ）。
 * presets（カスタム質問）とは別キーで永続化する。永続化は companion/storage.ts、
 * UI は companion/Companion.tsx 側で扱う。
 */

export interface Settings {
  /** 音声で回答（Phase 8）。ON のとき ask に tts:true を付け、回答を音声でも再生する。既定 OFF。 */
  voiceAnswer: boolean
}

/** 既定設定。音声回答は OFF（明示 ON するまで現行と等価）。 */
export const DEFAULT_SETTINGS: Settings = { voiceAnswer: false }

/** unknown が Settings の形（voiceAnswer:boolean）か検証する。 */
export function validateSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return typeof s.voiceAnswer === 'boolean'
}

/** Settings を保存用 JSON 文字列にする（既知フィールドのみ・前方互換の余分は載せない）。 */
export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ voiceAnswer: settings.voiceAnswer })
}

/**
 * 保存 JSON 文字列を Settings に戻す。不正 JSON・型違い・未設定（""）は
 * DEFAULT_SETTINGS（OFF）へフォールバックする（黙って壊さない）。
 */
export function parseSettings(raw: string): Settings {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
  if (!validateSettings(data)) return { ...DEFAULT_SETTINGS }
  return { voiceAnswer: data.voiceAnswer }
}
