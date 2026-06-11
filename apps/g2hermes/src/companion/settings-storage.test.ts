import { describe, expect, test } from 'bun:test'
import { DEFAULT_PRESETS } from './presets'
import { DEFAULT_SETTINGS } from './settings'
import {
  createPresetStore,
  createSettingsStore,
  type StorageBridge,
  type StorageLocalStorage,
} from './storage'

const PRESETS_KEY = 'g2hermes.presets'
const SETTINGS_KEY = 'g2hermes.settings'

/** in-memory Map を backing にした bridge モック（presets / settings 共用）。 */
function memoryBridge(): { bridge: StorageBridge; store: Map<string, string> } {
  const store = new Map<string, string>()
  const bridge: StorageBridge = {
    async getLocalStorage(key) {
      return store.get(key) ?? ''
    },
    async setLocalStorage(key, value) {
      store.set(key, value)
    },
  }
  return { bridge, store }
}

/** in-memory localStorage モック。 */
function memoryLocalStorage(): {
  ls: StorageLocalStorage
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  const ls: StorageLocalStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
  }
  return { ls, store }
}

describe('createSettingsStore', () => {
  test('save→load で settings を round-trip する', async () => {
    const { bridge } = memoryBridge()
    const store = createSettingsStore({ getBridge: async () => bridge })
    await store.saveSettings({ voiceAnswer: true })
    expect(await store.loadSettings()).toEqual({ voiceAnswer: true })
  })

  test('未設定は既定 OFF', async () => {
    const { bridge } = memoryBridge()
    const store = createSettingsStore({ getBridge: async () => bridge })
    expect(await store.loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  test('bridge 復帰後の起動でも fallback 保存値を失わない（localStorage→bridge 移送・Codex P2）', async () => {
    const { ls, store: lsMem } = memoryLocalStorage()

    // 起動1: bridge タイムアウト（null）→ localStorage にのみ保存される
    const store1 = createSettingsStore({
      getBridge: async () => null,
      localStorage: ls,
    })
    await store1.saveSettings({ voiceAnswer: true })
    expect(lsMem.get(SETTINGS_KEY)).toBeDefined()

    // 起動2: bridge 即利用可（まだ空）+ 同じ localStorage → load が localStorage 値を採用し bridge へ移送
    const { bridge, store: brMem } = memoryBridge()
    const store2 = createSettingsStore({
      getBridge: async () => bridge,
      localStorage: ls,
    })
    expect(await store2.loadSettings()).toEqual({ voiceAnswer: true })
    // bridge に移送され、以降は bridge からも読める（再起動後も残る）
    expect(brMem.get(SETTINGS_KEY)).toBe(JSON.stringify({ voiceAnswer: true }))
  })
})

describe('presets と settings はキーが衝突しない', () => {
  test('同一 bridge で別キーに保存され互いに上書きしない', async () => {
    const { bridge, store: mem } = memoryBridge()
    const getBridge = async () => bridge
    const presetStore = createPresetStore({ getBridge })
    const settingsStore = createSettingsStore({ getBridge })

    await settingsStore.saveSettings({ voiceAnswer: true })
    await presetStore.savePresets([{ id: 'x', label: 'L', text: 'T' }])

    // それぞれ別キーに格納されている
    expect(mem.has(SETTINGS_KEY)).toBe(true)
    expect(mem.has(PRESETS_KEY)).toBe(true)

    // 互いの保存で消えていない
    expect(await settingsStore.loadSettings()).toEqual({ voiceAnswer: true })
    expect(await presetStore.loadPresets()).toEqual([
      { id: 'x', label: 'L', text: 'T' },
    ])
    // presets を default に巻き戻していない（settings 保存が presets キーを汚していない）
    expect(await presetStore.loadPresets()).not.toEqual(DEFAULT_PRESETS)
  })
})
