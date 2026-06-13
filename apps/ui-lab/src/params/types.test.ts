import { describe, expect, test } from 'bun:test'
import {
  BORDER_COLOR_RANGE,
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  DEFAULT_DESIGN_PARAMS,
  DISPLAY_RANGE,
  LINE_GAP_RANGE,
  PADDING_RANGE,
  parseDesignParams,
  serializeDesignParams,
} from './types'

describe('DesignParams defaults', () => {
  test('all numeric defaults are inside official ranges', () => {
    const p = DEFAULT_DESIGN_PARAMS
    expect(p.borderWidth).toBeGreaterThanOrEqual(BORDER_WIDTH_RANGE.min)
    expect(p.borderWidth).toBeLessThanOrEqual(BORDER_WIDTH_RANGE.max)
    expect(p.borderRadius).toBeGreaterThanOrEqual(BORDER_RADIUS_RANGE.min)
    expect(p.borderRadius).toBeLessThanOrEqual(BORDER_RADIUS_RANGE.max)
    expect(p.borderColor).toBeGreaterThanOrEqual(BORDER_COLOR_RANGE.min)
    expect(p.borderColor).toBeLessThanOrEqual(BORDER_COLOR_RANGE.max)
    expect(p.padding).toBeGreaterThanOrEqual(PADDING_RANGE.min)
    expect(p.padding).toBeLessThanOrEqual(PADDING_RANGE.max)
    expect(p.cardWidth).toBeLessThanOrEqual(DISPLAY_RANGE.width.max)
    expect(p.cardHeight).toBeLessThanOrEqual(DISPLAY_RANGE.height.max)
    expect(p.lineGap).toBeGreaterThanOrEqual(LINE_GAP_RANGE.min)
    expect(p.lineGap).toBeLessThanOrEqual(LINE_GAP_RANGE.max)
  })

  test('serialize/parse round-trips a full params object', () => {
    const params = {
      ...DEFAULT_DESIGN_PARAMS,
      borderWidth: 5,
      borderRadius: 10,
      borderColor: 2,
      padding: 16,
      selectionStyle: 'filled' as const,
      showStatusBar: false,
      separator: 'dots' as const,
      skeleton: 'split' as const,
      modal: true,
    }
    expect(parseDesignParams(serializeDesignParams(params))).toEqual(params)
  })

  test('invalid or out-of-range values are normalized', () => {
    const p = parseDesignParams(
      JSON.stringify({
        borderWidth: 99,
        padding: -2,
        cardWidth: 999,
        cardHeight: 999,
        selectionStyle: 'unknown',
        modal: 'yes',
      }),
    )
    expect(p.borderWidth).toBe(BORDER_WIDTH_RANGE.max)
    expect(p.padding).toBe(PADDING_RANGE.min)
    expect(p.cardWidth).toBe(DISPLAY_RANGE.width.max)
    expect(p.cardHeight).toBe(DISPLAY_RANGE.height.max)
    expect(p.selectionStyle).toBe(DEFAULT_DESIGN_PARAMS.selectionStyle)
    expect(p.modal).toBe(DEFAULT_DESIGN_PARAMS.modal)
  })
})
