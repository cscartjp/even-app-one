import { describe, expect, test } from 'bun:test'
import { DEFAULT_DESIGN_PARAMS, type DesignParams } from '../params/types'
import {
  buildModalImage,
  MODAL_IMAGE_MAX_H,
  MODAL_IMAGE_MAX_W,
} from './buildModalImage'

function params(overrides: Partial<DesignParams> = {}): DesignParams {
  return { ...DEFAULT_DESIGN_PARAMS, ...overrides }
}

describe('buildModalImage', () => {
  test('size stays within G2 image-container limits', () => {
    const img = buildModalImage(params())
    expect(img.width).toBeGreaterThanOrEqual(20)
    expect(img.width).toBeLessThanOrEqual(MODAL_IMAGE_MAX_W)
    expect(img.height).toBeGreaterThanOrEqual(20)
    expect(img.height).toBeLessThanOrEqual(MODAL_IMAGE_MAX_H)
    // 公式上限の交差（幅 ≤200 / 高さ ≤100）も満たす
    expect(img.width).toBeLessThanOrEqual(200)
    expect(img.height).toBeLessThanOrEqual(100)
  })

  test('data length equals width * height (one 4-bit value per pixel)', () => {
    const img = buildModalImage(params())
    expect(img.data.length).toBe(img.width * img.height)
  })

  test('every pixel is within the 4-bit greyscale range 0..15', () => {
    const img = buildModalImage(params())
    for (const v of img.data) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(15)
    }
  })

  test('is deterministic: same params produce identical output', () => {
    const a = buildModalImage(params({ borderColor: 9, padding: 4 }))
    const b = buildModalImage(params({ borderColor: 9, padding: 4 }))
    expect(a.width).toBe(b.width)
    expect(a.height).toBe(b.height)
    expect(a.data).toEqual(b.data)
  })

  test('is opaque: interior is filled with a non-zero background level', () => {
    const img = buildModalImage(params())
    const cx = Math.floor(img.width / 2)
    const cy = Math.floor(img.height / 2)
    expect(img.data[cy * img.width + cx]).toBeGreaterThan(0)
  })

  test('has a bright border ring brighter than the background fill', () => {
    const img = buildModalImage(params())
    const topLeft = img.data[0] ?? 0
    const center =
      Math.floor(img.height / 2) * img.width + Math.floor(img.width / 2)
    const interior = img.data[center] ?? 0
    expect(topLeft).toBeGreaterThan(interior)
  })
})
