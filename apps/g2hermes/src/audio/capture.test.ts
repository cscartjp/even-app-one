import { describe, expect, test } from 'bun:test'
import {
  concatChunks,
  encodeWav,
  isTooShort,
  MAX_RECORDING_MS,
  SAMPLE_RATE,
} from './capture'

/** WAV ヘッダの主要フィールドを読む（little-endian）。 */
function readWavHeader(buf: Buffer) {
  return {
    riff: buf.toString('ascii', 0, 4),
    wave: buf.toString('ascii', 8, 12),
    channels: buf.readUInt16LE(22),
    sampleRate: buf.readUInt32LE(24),
    bitsPerSample: buf.readUInt16LE(34),
    dataBytes: buf.readUInt32LE(40),
  }
}

describe('concatChunks', () => {
  test('空配列は長さ0のFloat32Array', () => {
    const out = concatChunks([])
    expect(out).toBeInstanceOf(Float32Array)
    expect(out.length).toBe(0)
  })

  test('複数チャンクを順序を保って結合する', () => {
    const out = concatChunks([
      new Float32Array([1, 2]),
      new Float32Array([3]),
      new Float32Array([4, 5]),
    ])
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('isTooShort（空/極短を弾く判定）', () => {
  test('空（0サンプル）は too short', () => {
    expect(isTooShort(new Float32Array(0))).toBe(true)
  })

  test('100ms（1600サンプル）は too short', () => {
    expect(isTooShort(new Float32Array(1600))).toBe(true)
  })

  test('閾値直下（499ms相当）は too short', () => {
    const samples = Math.floor((499 / 1000) * SAMPLE_RATE)
    expect(isTooShort(new Float32Array(samples))).toBe(true)
  })

  test('閾値ちょうど（500ms=8000サンプル）は too short でない', () => {
    expect(isTooShort(new Float32Array(8000))).toBe(false)
  })

  test('1秒（16000サンプル）は too short でない', () => {
    expect(isTooShort(new Float32Array(16000))).toBe(false)
  })
})

describe('encodeWav（PCM→WAV）', () => {
  test('通常: 16kHz mono 16bit の WAV を返す', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const blob = encodeWav(samples)
    expect(blob.type).toBe('audio/wav')
    const buf = Buffer.from(await blob.arrayBuffer())
    const h = readWavHeader(buf)
    expect(h.riff).toBe('RIFF')
    expect(h.wave).toBe('WAVE')
    expect(h.channels).toBe(1)
    expect(h.sampleRate).toBe(SAMPLE_RATE)
    expect(h.bitsPerSample).toBe(16)
    // 5サンプル × 2バイト
    expect(h.dataBytes).toBe(5 * 2)
    expect(buf.length).toBe(44 + 5 * 2)
  })

  test('無音: 全ゼロ1秒分のデータ部が全て0', async () => {
    const blob = encodeWav(new Float32Array(SAMPLE_RATE))
    const buf = Buffer.from(await blob.arrayBuffer())
    expect(buf.length).toBe(44 + SAMPLE_RATE * 2)
    // データ部（offset 44 以降）が全て 0
    for (let i = 44; i < buf.length; i += 2) {
      expect(buf.readInt16LE(i)).toBe(0)
    }
  })

  test('最大長: 30秒分（480000サンプル）が ~960KB の WAV になる', async () => {
    const maxSamples = (MAX_RECORDING_MS / 1000) * SAMPLE_RATE
    const blob = encodeWav(new Float32Array(maxSamples))
    expect(blob.size).toBe(44 + maxSamples * 2)
  })
})
