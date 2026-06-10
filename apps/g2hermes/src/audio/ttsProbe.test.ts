import { describe, expect, test } from 'bun:test'
import {
  formatVerdictLine,
  isProbeEnabled,
  summarizeCapability,
  type VoiceLike,
} from './ttsProbe'

describe('summarizeCapability（capability 整形・実 window 非依存）', () => {
  test('voices 0件: voiceCount 0・hasJa false', () => {
    expect(summarizeCapability(true, [])).toEqual({
      hasSpeechSynthesis: true,
      voiceCount: 0,
      hasJa: false,
    })
  })

  test('ja 有り: hasJa true・件数を数える', () => {
    const voices: VoiceLike[] = [
      { lang: 'en-US' },
      { lang: 'ja-JP' },
      { lang: 'en-GB' },
    ]
    expect(summarizeCapability(true, voices)).toEqual({
      hasSpeechSynthesis: true,
      voiceCount: 3,
      hasJa: true,
    })
  })

  test('lang の大小文字を問わず ja を拾う（JA-jp）', () => {
    expect(summarizeCapability(true, [{ lang: 'JA-jp' }]).hasJa).toBe(true)
  })

  test('speechSynthesis 未対応: hasSpeechSynthesis false', () => {
    expect(summarizeCapability(false, [])).toEqual({
      hasSpeechSynthesis: false,
      voiceCount: 0,
      hasJa: false,
    })
  })
})

describe('formatVerdictLine（verdict→グラス1行）', () => {
  test('spk=Y aud=N v=3', () => {
    expect(formatVerdictLine({ spk: true, aud: false, voiceCount: 3 })).toBe(
      '🔊spk=Y aud=N v=3',
    )
  })

  test('spk=N aud=Y v=0', () => {
    expect(formatVerdictLine({ spk: false, aud: true, voiceCount: 0 })).toBe(
      '🔊spk=N aud=Y v=0',
    )
  })
})

describe("isProbeEnabled（gate・'1' のみ ON）", () => {
  test('未設定（undefined）は false', () => {
    expect(isProbeEnabled(undefined)).toBe(false)
  })

  test('空文字は false', () => {
    expect(isProbeEnabled('')).toBe(false)
  })

  test("'0' は false（OFF のつもりの値を ON にしない）", () => {
    expect(isProbeEnabled('0')).toBe(false)
  })

  test("'false' は false", () => {
    expect(isProbeEnabled('false')).toBe(false)
  })

  test("'1' は true", () => {
    expect(isProbeEnabled('1')).toBe(true)
  })
})
