import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  validateSettings,
} from './settings'

describe('settings — 既定', () => {
  test('voiceAnswer の既定は OFF（false）', () => {
    expect(DEFAULT_SETTINGS.voiceAnswer).toBe(false)
  })
})

describe('serializeSettings / parseSettings round-trip', () => {
  test('true / false を往復できる', () => {
    for (const voiceAnswer of [true, false]) {
      const round = parseSettings(serializeSettings({ voiceAnswer }))
      expect(round.voiceAnswer).toBe(voiceAnswer)
    }
  })
})

describe('parseSettings フォールバック（OFF）', () => {
  test('未設定（""）は既定 OFF', () => {
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS)
  })

  test('不正 JSON は既定 OFF', () => {
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS)
  })

  test('型違い（voiceAnswer が文字列）は既定 OFF', () => {
    expect(parseSettings('{"voiceAnswer":"yes"}')).toEqual(DEFAULT_SETTINGS)
  })

  test('フィールド欠落は既定 OFF', () => {
    expect(parseSettings('{}')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('validateSettings', () => {
  test('boolean のみ受理', () => {
    expect(validateSettings({ voiceAnswer: true })).toBe(true)
    expect(validateSettings({ voiceAnswer: 1 })).toBe(false)
    expect(validateSettings(null)).toBe(false)
    expect(validateSettings('x')).toBe(false)
  })
})
