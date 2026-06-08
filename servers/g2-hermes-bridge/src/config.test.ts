import { describe, expect, test } from 'bun:test'
import { loadConfig } from './config'

describe('loadConfig', () => {
  test('未設定は既定値', () => {
    const c = loadConfig({})
    expect(c.port).toBe(8787)
    expect(c.hermesTimeoutMs).toBe(30000)
    expect(c.bridgeToken).toBe('dev-token')
  })

  test('不正な PORT / HERMES_TIMEOUT_MS は既定値にフォールバック', () => {
    expect(loadConfig({ PORT: 'abc' }).port).toBe(8787)
    expect(loadConfig({ PORT: '' }).port).toBe(8787)
    expect(loadConfig({ PORT: '0' }).port).toBe(8787)
    expect(loadConfig({ PORT: '-1' }).port).toBe(8787)
    expect(loadConfig({ HERMES_TIMEOUT_MS: 'x' }).hermesTimeoutMs).toBe(30000)
    expect(loadConfig({ HERMES_TIMEOUT_MS: '' }).hermesTimeoutMs).toBe(30000)
  })

  test('有効値は採用', () => {
    expect(loadConfig({ PORT: '9000' }).port).toBe(9000)
    expect(loadConfig({ HERMES_TIMEOUT_MS: '5000' }).hermesTimeoutMs).toBe(5000)
  })
})
