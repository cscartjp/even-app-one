import type { DesignParams, SelectionStyle, Skeleton } from '../params/types'

export const DISPLAY_W = 576
export const DISPLAY_H = 288
export const SELECTED_ROW_INDEX = 1

export interface CardContainerConfig {
  containerID: number
  containerName: string
  xPosition: number
  yPosition: number
  width: number
  height: number
  borderWidth: number
  borderColor: number
  borderRadius: number
  paddingLength: number
  content: string
  isEventCapture: 0 | 1
  textColor: number
  backgroundColor: number
}

interface RowSpec {
  id: number
  name: string
  label: string
  x: number
  y: number
  w: number
  h: number
  selected: boolean
  card: boolean
}

const LABELS = [
  'Layout density',
  'Selected row',
  'Modal preview',
  'Export target',
]
const APP_VERSION =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev'

function border(params: DesignParams, enabled: boolean) {
  if (!enabled || params.borderWidth === 0) {
    return { borderWidth: 0, borderColor: 0, borderRadius: 0 }
  }
  return {
    borderWidth: params.borderWidth,
    borderColor: params.borderColor,
    borderRadius: params.borderRadius,
  }
}

function toneLabel(value: number) {
  return value >= 12 ? 'bright' : value >= 7 ? 'mid' : 'dim'
}

function separatorContent(params: DesignParams) {
  if (params.separator === 'line') return '------------------------------'
  if (params.separator === 'dots') return '. . . . . . . . . . . . . . .'
  return ''
}

function rowContent(label: string, selected: boolean, style: SelectionStyle) {
  if (!selected) return `  ${label}`
  if (style === 'cursor') return `▶ ${label}`
  if (style === 'inverted') return `> ${label.toUpperCase()} <`
  if (style === 'filled') return `█ ${label} █`
  return `▣ ${label}`
}

function rowBorder(params: DesignParams, spec: RowSpec) {
  if (spec.selected && params.selectionStyle === 'thickBorder') {
    return {
      borderWidth: Math.min(5, Math.max(params.borderWidth + 2, 3)),
      borderColor: 15,
      borderRadius: params.borderRadius,
    }
  }
  return border(params, spec.card)
}

function rowBackground(params: DesignParams, selected: boolean) {
  if (!selected) return 0
  if (params.selectionStyle === 'filled') return params.textColor
  if (params.selectionStyle === 'inverted') return params.textColor
  return 0
}

function overlay(params: DesignParams): CardContainerConfig {
  return {
    containerID: 1,
    containerName: 'overlay',
    xPosition: 0,
    yPosition: 0,
    width: DISPLAY_W,
    height: DISPLAY_H,
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    paddingLength: 0,
    content: '',
    isEventCapture: 1,
    textColor: params.textColor,
    backgroundColor: params.modal ? params.modalDim : 0,
  }
}

function statusBar(params: DesignParams): CardContainerConfig {
  return {
    containerID: 2,
    containerName: 'status',
    xPosition: 10,
    yPosition: 2,
    width: DISPLAY_W - 20,
    height: 24,
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    paddingLength: 0,
    content: `UI LAB v${APP_VERSION}  ${params.skeleton}  ${toneLabel(params.textColor)}`,
    isEventCapture: 0,
    textColor: params.textColor,
    backgroundColor: params.modal ? params.modalDim : 0,
  }
}

function separator(
  params: DesignParams,
  id: number,
  y: number,
): CardContainerConfig {
  return {
    containerID: id,
    containerName: 'separator',
    xPosition: 16,
    yPosition: y,
    width: DISPLAY_W - 32,
    height: 18,
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    paddingLength: 0,
    content: separatorContent(params),
    isEventCapture: 0,
    textColor: params.textColor,
    backgroundColor: params.modal ? params.modalDim : 0,
  }
}

function card(params: DesignParams, spec: RowSpec): CardContainerConfig {
  const b = rowBorder(params, spec)
  return {
    containerID: spec.id,
    containerName: spec.name,
    xPosition: spec.x,
    yPosition: spec.y,
    width: spec.w,
    height: spec.h,
    ...b,
    paddingLength: spec.card ? params.padding : 0,
    content: rowContent(spec.label, spec.selected, params.selectionStyle),
    isEventCapture: 0,
    textColor:
      spec.selected && params.selectionStyle === 'inverted'
        ? 0
        : params.textColor,
    backgroundColor: params.modal
      ? params.modalDim
      : rowBackground(params, spec.selected),
  }
}

function modalCard(params: DesignParams): CardContainerConfig {
  return {
    containerID: 8,
    containerName: 'modal',
    xPosition: 86,
    yPosition: 78,
    width: 404,
    height: 118,
    borderWidth: Math.max(params.borderWidth, 2),
    borderColor: params.textColor,
    borderRadius: params.borderRadius,
    paddingLength: Math.max(params.padding, 8),
    content: 'Modal preview\nTap toggles modal\nBackground dimmed',
    isEventCapture: 0,
    textColor: params.textColor,
    backgroundColor: 0,
  }
}

function clampWithinDisplay(value: number, max: number) {
  return Math.min(max, Math.max(1, value))
}

function listRows(params: DesignParams): RowSpec[] {
  const startY = params.showStatusBar ? 36 : 12
  const h = clampWithinDisplay(params.cardHeight, 52)
  return LABELS.map((label, index) => ({
    id: 4 + index,
    name: `row-${index + 1}`,
    label,
    x: 18,
    y: startY + index * (h + params.lineGap),
    w: DISPLAY_W - 36,
    h,
    selected: index === SELECTED_ROW_INDEX,
    card: false,
  }))
}

function cardRows(params: DesignParams): RowSpec[] {
  const w = clampWithinDisplay(params.cardWidth, DISPLAY_W - 24)
  const h = clampWithinDisplay(params.cardHeight, 64)
  const x = Math.round((DISPLAY_W - w) / 2)
  const startY = params.showStatusBar ? 40 : 14
  return LABELS.slice(0, 3).map((label, index) => ({
    id: 4 + index,
    name: `card-${index + 1}`,
    label,
    x,
    y: startY + index * (h + params.lineGap),
    w,
    h,
    selected: index === SELECTED_ROW_INDEX,
    card: true,
  }))
}

function splitRows(params: DesignParams): RowSpec[] {
  const gap = 12
  const w = Math.min(260, Math.floor((DISPLAY_W - 36 - gap) / 2))
  const h = Math.min(params.cardHeight + 18, 96)
  const y1 = params.showStatusBar ? 42 : 16
  const y2 = y1 + h + params.lineGap
  return [
    {
      id: 4,
      name: 'left-top',
      label: LABELS[0],
      x: 12,
      y: y1,
      w,
      h,
      selected: false,
      card: true,
    },
    {
      id: 5,
      name: 'right-top',
      label: LABELS[1],
      x: 12 + w + gap,
      y: y1,
      w,
      h,
      selected: true,
      card: true,
    },
    {
      id: 6,
      name: 'left-bottom',
      label: LABELS[2],
      x: 12,
      y: y2,
      w,
      h,
      selected: false,
      card: true,
    },
    {
      id: 7,
      name: 'right-bottom',
      label: LABELS[3],
      x: 12 + w + gap,
      y: y2,
      w,
      h,
      selected: false,
      card: true,
    },
  ]
}

function rowsForSkeleton(params: DesignParams, skeleton: Skeleton): RowSpec[] {
  if (skeleton === 'list') return listRows(params)
  if (skeleton === 'split') return splitRows(params)
  return cardRows(params)
}

export function buildContainers(params: DesignParams): CardContainerConfig[] {
  const configs: CardContainerConfig[] = [overlay(params)]
  if (params.showStatusBar) configs.push(statusBar(params))

  const sep = separator(params, 3, params.showStatusBar ? 28 : 2)
  if (sep.content) configs.push(sep)

  configs.push(
    ...rowsForSkeleton(params, params.skeleton).map((r) => card(params, r)),
  )
  if (params.modal) configs.push(modalCard(params))

  return configs.slice(0, 8)
}
