/**
 * コンパニオン カスタム質問のデータモデル（純粋関数のみ）。
 * label はグラス idle メニュー表示用の短い文字列、text は Hermes へ送る実プロンプト。
 * 永続化は companion/storage.ts、UI 編集は companion/PresetEditor.tsx 側で扱う。
 */

export interface Preset {
  /** 安定 ID。並べ替え / 削除 / React key に使う。 */
  id: string
  /** グラス idle メニューに出す短いラベル（1〜20 文字）。 */
  label: string
  /** Hermes へ送る実プロンプト（1〜2000 文字・グラス非表示）。 */
  text: string
}

/** label の最大文字数（グラス idle メニュー 1 行の表示制約）。 */
export const LABEL_MAX = 20
/** text の最大文字数（Bridge bodyLimit に収まる範囲）。 */
export const TEXT_MAX = 2000
/** プリセット件数の下限 / 上限（idle はマイク行・ヒント行と同居）。 */
export const PRESET_MIN = 1
export const PRESET_MAX = 8

/** デフォルトシード = 現行 AppGlasses の固定 4 問。 */
export const DEFAULT_PRESETS: Preset[] = [
  { id: 'seed-intro', label: '自己紹介', text: '短く自己紹介して' },
  {
    id: 'seed-can',
    label: '今できること',
    text: 'あなたが今できることを3つ、短く教えて',
  },
  { id: 'seed-trivia', label: '豆知識', text: '面白い豆知識を1つ、短く教えて' },
  { id: 'seed-date', label: '今日の日付', text: '今日の日付を教えて' },
]

/** 空（空白のみを含む）でなく、上限文字数に収まる文字列か。 */
function withinBounds(value: string, max: number): boolean {
  return value.trim().length >= 1 && value.length <= max
}

/** 1 件の preset が型・文字数制約を満たすか（不正 JSON 由来の unknown も受ける）。 */
export function validatePreset(value: unknown): value is Preset {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Record<string, unknown>
  if (typeof p.id !== 'string' || p.id.length === 0) return false
  if (typeof p.label !== 'string' || !withinBounds(p.label, LABEL_MAX)) {
    return false
  }
  if (typeof p.text !== 'string' || !withinBounds(p.text, TEXT_MAX)) {
    return false
  }
  return true
}

/** presets 配列を保存用 JSON 文字列にする。 */
export function serialize(presets: Preset[]): string {
  return JSON.stringify(presets)
}

/** デフォルトシードの新しいコピー（共有参照の誤変更を防ぐ）。 */
function defaultSeed(): Preset[] {
  return DEFAULT_PRESETS.map((p) => ({ ...p }))
}

/**
 * 保存 JSON 文字列を presets 配列に戻す。不正 JSON・配列でない・件数違反・
 * 検証落ち要素を含む場合はデフォルトシードへフォールバックする（黙って壊さない）。
 */
export function parse(raw: string): Preset[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return defaultSeed()
  }
  if (!Array.isArray(data)) return defaultSeed()
  if (data.length < PRESET_MIN || data.length > PRESET_MAX) return defaultSeed()
  if (!data.every(validatePreset)) return defaultSeed()
  return data
}
