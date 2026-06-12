import { describe, expect, test } from 'bun:test'
import {
  createDesignParamsStore,
  type StorageBridge,
  type StorageLocalStorage,
} from './storage'
import { DEFAULT_DESIGN_PARAMS } from './types'

const KEY = 'ui-lab.designParams'

function memoryBridge(): { bridge: StorageBridge; store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    bridge: {
      async getLocalStorage(key) {
        return store.get(key) ?? ''
      },
      async setLocalStorage(key, value) {
        store.set(key, value)
      },
    },
    store,
  }
}

function memoryLocalStorage(): {
  ls: StorageLocalStorage
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  return {
    ls: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value)
      },
    },
    store,
  }
}

describe('createDesignParamsStore', () => {
  test('bridge storage saves and restores the last DesignParams', async () => {
    const { bridge } = memoryBridge()
    const store = createDesignParamsStore({ getBridge: async () => bridge })
    const params = { ...DEFAULT_DESIGN_PARAMS, borderWidth: 4, modal: true }
    await store.save(params)
    expect(await store.load()).toEqual(params)
  })

  test('localStorage fallback saves and restores when bridge is absent', async () => {
    const { ls, store: mem } = memoryLocalStorage()
    const store = createDesignParamsStore({
      getBridge: async () => null,
      localStorage: ls,
    })
    const params = {
      ...DEFAULT_DESIGN_PARAMS,
      skeleton: 'split' as const,
      separator: 'dots' as const,
    }
    await store.save(params)
    expect(mem.has(KEY)).toBe(true)
    expect(await store.load()).toEqual(params)
  })

  test('local fallback is migrated to bridge after bridge becomes available', async () => {
    const { ls } = memoryLocalStorage()
    const fallbackStore = createDesignParamsStore({
      getBridge: async () => null,
      localStorage: ls,
    })
    const params = { ...DEFAULT_DESIGN_PARAMS, textColor: 7 }
    await fallbackStore.save(params)

    const { bridge, store: bridgeMem } = memoryBridge()
    const bridgeStore = createDesignParamsStore({
      getBridge: async () => bridge,
      localStorage: ls,
    })
    expect(await bridgeStore.load()).toEqual(params)
    expect(bridgeMem.get(KEY)).toBe(JSON.stringify(params))
  })
})
