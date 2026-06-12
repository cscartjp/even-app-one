export const BORDER_WIDTH_RANGE = { min: 0, max: 5 } as const
export const BORDER_RADIUS_RANGE = { min: 0, max: 10 } as const
export const BORDER_COLOR_RANGE = { min: 0, max: 15 } as const
export const PADDING_RANGE = { min: 0, max: 32 } as const
export const DISPLAY_RANGE = {
  width: { min: 96, max: 576 },
  height: { min: 32, max: 288 },
} as const
export const LINE_GAP_RANGE = { min: 0, max: 24 } as const
export const TONE_RANGE = { min: 0, max: 15 } as const

export const SELECTION_STYLES = [
  'inverted',
  'cursor',
  'filled',
  'thickBorder',
] as const
export type SelectionStyle = (typeof SELECTION_STYLES)[number]

export const SEPARATORS = ['none', 'line', 'dots'] as const
export type SeparatorStyle = (typeof SEPARATORS)[number]

export const SKELETONS = ['list', 'cards', 'split'] as const
export type Skeleton = (typeof SKELETONS)[number]

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
  textColor: number
  modal: boolean
  modalDim: number
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
  textColor: 15,
  modal: false,
  modalDim: 4,
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
    textColor: clampInt(
      input.textColor,
      TONE_RANGE.min,
      TONE_RANGE.max,
      d.textColor,
    ),
    modal: pickBool(input.modal, d.modal),
    modalDim: clampInt(
      input.modalDim,
      TONE_RANGE.min,
      TONE_RANGE.max,
      d.modalDim,
    ),
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
