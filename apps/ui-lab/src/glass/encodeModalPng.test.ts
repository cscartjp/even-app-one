import { describe, expect, test } from 'bun:test'
import { DEFAULT_DESIGN_PARAMS } from '../params/types'
import { buildModalImage } from './buildModalImage'
import { encodeModalPng } from './encodeModalPng'

// PNG ファイルシグネチャ（最初の 8 バイト）。これで始まらなければ host は decode できない。
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('encodeModalPng', () => {
  test('output starts with the PNG file signature (regression: raw pixels would not)', () => {
    const png = encodeModalPng(buildModalImage(DEFAULT_DESIGN_PARAMS))
    expect(png.slice(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE)
  })

  test('output is a byte array (every value 0..255) longer than the signature', () => {
    const png = encodeModalPng(buildModalImage(DEFAULT_DESIGN_PARAMS))
    expect(png.length).toBeGreaterThan(PNG_SIGNATURE.length)
    for (const b of png) {
      expect(Number.isInteger(b)).toBe(true)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(255)
    }
  })

  test('is deterministic: same grid produces identical PNG bytes', () => {
    const grid = buildModalImage({
      ...DEFAULT_DESIGN_PARAMS,
      borderColor: 9,
      padding: 4,
    })
    expect(encodeModalPng(grid)).toEqual(encodeModalPng(grid))
  })
})
