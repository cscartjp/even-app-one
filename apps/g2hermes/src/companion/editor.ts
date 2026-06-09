/**
 * プリセット編集の純粋関数群（React 非依存）。
 * すべて新しい配列 / 要素を返し、引数の配列・要素を破壊しない（immutable）。
 * UI（PresetEditor.tsx）はこれらを呼び、結果を onChange で App へ返す。
 * 保存は canPersist が true のときだけ行い、不正リストの保存→次回起動 default 落ちを防ぐ。
 */
import { PRESET_MAX, PRESET_MIN, type Preset, validatePreset } from './presets'

/** 末尾に空の新規プリセットを1件足す（id は呼び出し側が採番）。上限到達時は不変。 */
export function addPreset(presets: Preset[], id: string): Preset[] {
  if (presets.length >= PRESET_MAX) return presets
  return [...presets, { id, label: '', text: '' }]
}

/** 指定 id の label/text を部分更新する。編集途中の不正値も保持し弾かない。 */
export function updatePreset(
  presets: Preset[],
  id: string,
  patch: Partial<Pick<Preset, 'label' | 'text'>>,
): Preset[] {
  return presets.map((p) => (p.id === id ? { ...p, ...patch } : p))
}

/** 指定 id を削除する。下限到達時は不変（最後の1件は消さない）。 */
export function removePreset(presets: Preset[], id: string): Preset[] {
  if (presets.length <= PRESET_MIN) return presets
  return presets.filter((p) => p.id !== id)
}

/** index の要素を up / down へ1つ動かす。端・範囲外は不変。 */
export function movePreset(
  presets: Preset[],
  index: number,
  dir: 'up' | 'down',
): Preset[] {
  if (index < 0 || index >= presets.length) return presets
  const target = dir === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= presets.length) return presets
  const next = [...presets]
  const tmp = next[index]
  next[index] = next[target]
  next[target] = tmp
  return next
}

/**
 * リスト全体が永続化可能か（件数 [MIN,MAX] かつ全要素が検証通過）。
 * presets.ts の parse() 受け入れ条件と一致させ、不正リストの保存を拒否する。
 */
export function canPersist(presets: Preset[]): boolean {
  if (presets.length < PRESET_MIN || presets.length > PRESET_MAX) return false
  return presets.every(validatePreset)
}
