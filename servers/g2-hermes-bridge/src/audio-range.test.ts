import { describe, expect, test } from 'bun:test'
import { parseRange } from './audio-range'

describe('parseRange', () => {
  test('Range 無しは full', () => {
    expect(parseRange(undefined, 100)).toEqual({ type: 'full' })
  })

  test('bytes=0-3 は inclusive な range', () => {
    expect(parseRange('bytes=0-3', 100)).toEqual({
      type: 'range',
      start: 0,
      end: 3,
    })
  })

  test('bytes=10- は末尾まで', () => {
    expect(parseRange('bytes=10-', 100)).toEqual({
      type: 'range',
      start: 10,
      end: 99,
    })
  })

  test('bytes=-20 は末尾 20 バイト', () => {
    expect(parseRange('bytes=-20', 100)).toEqual({
      type: 'range',
      start: 80,
      end: 99,
    })
  })

  test('end が総長超過は末尾にクランプ', () => {
    expect(parseRange('bytes=90-999', 100)).toEqual({
      type: 'range',
      start: 90,
      end: 99,
    })
  })

  test('start >= total は unsatisfiable', () => {
    expect(parseRange('bytes=100-200', 100)).toEqual({ type: 'unsatisfiable' })
  })

  test('start > end は unsatisfiable', () => {
    expect(parseRange('bytes=50-10', 100)).toEqual({ type: 'unsatisfiable' })
  })

  test('bytes 以外の単位は unsatisfiable', () => {
    expect(parseRange('items=0-3', 100)).toEqual({ type: 'unsatisfiable' })
  })

  test('total=0 は unsatisfiable', () => {
    expect(parseRange('bytes=0-0', 0)).toEqual({ type: 'unsatisfiable' })
  })
})
