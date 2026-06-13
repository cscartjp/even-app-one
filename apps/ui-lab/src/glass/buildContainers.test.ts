import { describe, expect, test } from 'bun:test'
import { DEFAULT_DESIGN_PARAMS, type DesignParams } from '../params/types'
import { buildContainers } from './buildContainers'

function params(overrides: Partial<DesignParams> = {}): DesignParams {
  return { ...DEFAULT_DESIGN_PARAMS, ...overrides }
}

function selected(p: DesignParams) {
  return buildContainers(p).find((c) =>
    c.content.toLowerCase().includes('selected row'),
  )
}

describe('buildContainers', () => {
  test('always has exactly one event-capture container and at most 8 text containers', () => {
    const matrix: Partial<DesignParams>[] = [
      {},
      { skeleton: 'list', showStatusBar: false, separator: 'none' },
      { skeleton: 'split', separator: 'dots', modal: true },
      { skeleton: 'cards', selectionStyle: 'filled', modal: true },
    ]
    for (const override of matrix) {
      const configs = buildContainers(params(override))
      expect(configs.filter((c) => c.isEventCapture === 1)).toHaveLength(1)
      expect(configs.length).toBeLessThanOrEqual(8)
    }
  })

  test('border ON/OFF maps to effective border values', () => {
    const on = selected(params({ borderWidth: 2, skeleton: 'cards' }))
    expect(on?.borderWidth).toBeGreaterThan(0)
    expect(on?.borderRadius).toBe(7)
    expect(on?.borderColor).toBe(12)

    const off = selected(params({ borderWidth: 0, skeleton: 'cards' }))
    expect(off?.borderWidth).toBe(0)
    expect(off?.borderRadius).toBe(0)
    expect(off?.borderColor).toBe(0)
  })

  test('selectionStyle maps all three selected-row appearances', () => {
    expect(selected(params({ selectionStyle: 'cursor' }))?.content).toContain(
      '▶',
    )
    expect(selected(params({ selectionStyle: 'filled' }))?.content).toContain(
      '█',
    )
    expect(
      selected(params({ selectionStyle: 'thickBorder' }))?.borderWidth,
    ).toBeGreaterThan(DEFAULT_DESIGN_PARAMS.borderWidth)
  })

  test('modal dims background borders and adds one bright foreground card', () => {
    const configs = buildContainers(params({ modal: true }))
    expect(configs.some((c) => c.containerName === 'modal')).toBe(true)
    const modal = configs.find((c) => c.containerName === 'modal')
    expect(modal?.borderColor).toBe(15)
    expect(modal?.borderWidth).toBeGreaterThanOrEqual(3)
    expect(configs.find((c) => c.containerName === 'card-1')?.borderColor).toBe(
      4,
    )
  })

  test('skeleton branches produce list, cards, and split layouts', () => {
    const list = buildContainers(params({ skeleton: 'list' }))
    expect(list.some((c) => c.containerName === 'row-1')).toBe(true)
    expect(list.find((c) => c.containerName === 'row-1')?.borderWidth).toBe(0)

    const cards = buildContainers(params({ skeleton: 'cards' }))
    expect(cards.some((c) => c.containerName === 'card-1')).toBe(true)
    expect(cards.find((c) => c.containerName === 'card-1')?.borderWidth).toBe(2)

    const split = buildContainers(params({ skeleton: 'split' }))
    expect(split.some((c) => c.containerName === 'left-top')).toBe(true)
    expect(split.some((c) => c.containerName === 'right-top')).toBe(true)
  })
})
