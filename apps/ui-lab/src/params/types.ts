export const BORDER_WIDTH_RANGE = { min: 0, max: 5 } as const
export const BORDER_RADIUS_RANGE = { min: 0, max: 10 } as const
export const BORDER_COLOR_RANGE = { min: 0, max: 15 } as const
export const PADDING_RANGE = { min: 0, max: 32 } as const
export const DISPLAY_RANGE = {
  width: { min: 96, max: 576 },
  height: { min: 32, max: 288 },
} as const
export const LINE_GAP_RANGE = { min: 0, max: 24 } as const

// G2 の TextContainerProperty が持つ色は borderColor のみ。テキスト色/背景色は
// SDK に無いため、明るさ/背景 dim の数値ノブは持たない（modal/選択は枠・文字で表現）。
export const SELECTION_STYLES = ['cursor', 'filled', 'thickBorder'] as const
export type SelectionStyle = (typeof SELECTION_STYLES)[number]

export const SEPARATORS = ['none', 'line', 'dots'] as const
export type SeparatorStyle = (typeof SEPARATORS)[number]

export const SKELETONS = ['list', 'cards', 'split'] as const
export type Skeleton = (typeof SKELETONS)[number]

// モーダルの描き方: border=枠だけ（無ちらつき・背後が透けて見える）/ image=1枚画像
// （背景塗り＋枠＋ラベルを焼き込む）。image は「不透明モーダルは作れない」検証デモ:
// G2 は透過加算ディスプレイで画像が z 順で前面でも背後を遮蔽できず不透明化は成立しない
// （実機検証 2026-06-15）。加えて画像コンテナは常時ちらつく（ファーム仕様・根治不可）。
// 詳細は docs/spec/ui-lab-sandbox.md「画像モーダル＝negative result」を参照。
export const MODAL_STYLES = ['border', 'image'] as const
export type ModalStyle = (typeof MODAL_STYLES)[number]

export interface DesignParams {
  borderWidth: number
  borderRadius: number
  borderColor: number
  padding: number
  cardWidth: number
  cardHeight: number
  lineGap: number
  selectionStyle: SelectionStyle
  showStatusBar: boolean
  separator: SeparatorStyle
  skeleton: Skeleton
  modal: boolean
  modalStyle: ModalStyle
}

export const DEFAULT_DESIGN_PARAMS: DesignParams = {
  borderWidth: 2,
  borderRadius: 7,
  borderColor: 12,
  padding: 8,
  cardWidth: 520,
  cardHeight: 58,
  lineGap: 8,
  selectionStyle: 'cursor',
  showStatusBar: true,
  separator: 'line',
  skeleton: 'cards',
  modal: false,
  modalStyle: 'border',
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && allowed.includes(value)
    ? (value as T[number])
    : fallback
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeDesignParams(value: unknown): DesignParams {
  const input = isRecord(value) ? value : {}
  const d = DEFAULT_DESIGN_PARAMS
  return {
    borderWidth: clampInt(
      input.borderWidth,
      BORDER_WIDTH_RANGE.min,
      BORDER_WIDTH_RANGE.max,
      d.borderWidth,
    ),
    borderRadius: clampInt(
      input.borderRadius,
      BORDER_RADIUS_RANGE.min,
      BORDER_RADIUS_RANGE.max,
      d.borderRadius,
    ),
    borderColor: clampInt(
      input.borderColor,
      BORDER_COLOR_RANGE.min,
      BORDER_COLOR_RANGE.max,
      d.borderColor,
    ),
    padding: clampInt(
      input.padding,
      PADDING_RANGE.min,
      PADDING_RANGE.max,
      d.padding,
    ),
    cardWidth: clampInt(
      input.cardWidth,
      DISPLAY_RANGE.width.min,
      DISPLAY_RANGE.width.max,
      d.cardWidth,
    ),
    cardHeight: clampInt(
      input.cardHeight,
      DISPLAY_RANGE.height.min,
      DISPLAY_RANGE.height.max,
      d.cardHeight,
    ),
    lineGap: clampInt(
      input.lineGap,
      LINE_GAP_RANGE.min,
      LINE_GAP_RANGE.max,
      d.lineGap,
    ),
    selectionStyle: pickEnum(
      input.selectionStyle,
      SELECTION_STYLES,
      d.selectionStyle,
    ),
    showStatusBar: pickBool(input.showStatusBar, d.showStatusBar),
    separator: pickEnum(input.separator, SEPARATORS, d.separator),
    skeleton: pickEnum(input.skeleton, SKELETONS, d.skeleton),
    modal: pickBool(input.modal, d.modal),
    modalStyle: pickEnum(input.modalStyle, MODAL_STYLES, d.modalStyle),
  }
}

export function serializeDesignParams(params: DesignParams): string {
  return JSON.stringify(normalizeDesignParams(params))
}

export function parseDesignParams(raw: string): DesignParams {
  try {
    return normalizeDesignParams(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_DESIGN_PARAMS
  }
}
