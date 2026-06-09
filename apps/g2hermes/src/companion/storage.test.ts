import { describe, expect, test } from 'bun:test'
import { DEFAULT_PRESETS, type Preset } from './presets'
import {
  createPresetStore,
  type PresetBridge,
  type PresetLocalStorage,
} from './storage'

/** 永続化キー（storage.ts と一致していること自体も検証対象）。 */
const KEY = 'g2hermes.presets'

const samplePresets: Preset[] = [
  { id: '1', label: 'A', text: 'aaa' },
  { id: '2', label: 'B', text: 'bbb' },
]

/** in-memory Map を backing にした bridge モック。initial を入れると既存値ありを再現する。 */
function memoryBridge(initial = ''): {
  bridge: PresetBridge
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  if (initial !== '') store.set(KEY, initial)
  const bridge: PresetBridge = {
    async getLocalStorage(key) {
      return store.get(key) ?? ''
    },
    async setLocalStorage(key, value) {
      store.set(key, value)
    },
  }
  return { bridge, store }
}

/** dev フォールバック検証用の localStorage モック。 */
function memoryLocalStorage(): {
  ls: PresetLocalStorage
  store: Map<string, string>
} {
  const store = new Map<string, string>()
  const ls: PresetLocalStorage = {
    getItem(key) {
      return store.get(key) ?? null
    },
    setItem(key, value) {
      store.set(key, value)
    },
  }
  return { ls, store }
}

/** ラベルだけ変えた 1 件 preset（直列化テストで書き込み順を識別するため）。 */
const mk = (label: string): Preset[] => [{ id: label, label, text: label }]
const labelsOf = (writes: string[]) =>
  writes.map((w) => (JSON.parse(w) as Preset[])[0].label)

describe('createPresetStore — bridge 経路', () => {
  test('save→load で JSON 配列を round-trip する', async () => {
    const { bridge } = memoryBridge()
    const store = createPresetStore({ getBridge: async () => bridge })
    await store.savePresets(samplePresets)
    expect(await store.loadPresets()).toEqual(samplePresets)
  })

  test('保存は 1 キー全件上書き（件数を減らす削除も反映される）', async () => {
    const { bridge } = memoryBridge()
    const store = createPresetStore({ getBridge: async () => bridge })
    await store.savePresets(samplePresets) // 2 件
    const one: Preset[] = [{ id: '1', label: 'A', text: 'aaa' }]
    await store.savePresets(one) // 1 件へ上書き
    expect(await store.loadPresets()).toEqual(one)
  })

  test('未設定キー（""）は DEFAULT_PRESETS へフォールバック', async () => {
    const { bridge } = memoryBridge()
    const store = createPresetStore({ getBridge: async () => bridge })
    expect(await store.loadPresets()).toEqual(DEFAULT_PRESETS)
  })

  test('不正 JSON は DEFAULT_PRESETS へフォールバック', async () => {
    const { bridge } = memoryBridge('{not json')
    const store = createPresetStore({ getBridge: async () => bridge })
    expect(await store.loadPresets()).toEqual(DEFAULT_PRESETS)
  })

  test('getLocalStorage が throw したら DEFAULT_PRESETS へ', async () => {
    const bridge: PresetBridge = {
      async getLocalStorage() {
        throw new Error('boom')
      },
      async setLocalStorage() {},
    }
    const store = createPresetStore({ getBridge: async () => bridge })
    expect(await store.loadPresets()).toEqual(DEFAULT_PRESETS)
  })
})

describe('createPresetStore — localStorage フォールバック（bridge 不在/タイムアウト）', () => {
  test('bridge が null なら localStorage に save/load する', async () => {
    const { ls, store: mem } = memoryLocalStorage()
    const store = createPresetStore({
      getBridge: async () => null,
      localStorage: ls,
    })
    await store.savePresets(samplePresets)
    expect(mem.get(KEY)).toBe(JSON.stringify(samplePresets))
    expect(await store.loadPresets()).toEqual(samplePresets)
  })

  test('localStorage 未設定（null）は DEFAULT_PRESETS へ', async () => {
    const { ls } = memoryLocalStorage()
    const store = createPresetStore({
      getBridge: async () => null,
      localStorage: ls,
    })
    expect(await store.loadPresets()).toEqual(DEFAULT_PRESETS)
  })

  test('bridge が後から利用可能になったら fallback 保存分を bridge へ再同期する', async () => {
    const { ls } = memoryLocalStorage()
    const { bridge, store: brMem } = memoryBridge()
    const brWrites: string[] = []
    const trackingBridge: PresetBridge = {
      getLocalStorage: bridge.getLocalStorage,
      async setLocalStorage(key, value) {
        brWrites.push(value)
        await bridge.setLocalStorage(key, value)
      },
    }
    let bridgeReady = false
    const store = createPresetStore({
      getBridge: async () => (bridgeReady ? trackingBridge : null),
      localStorage: ls,
    })

    // 1) bridge 未取得（起動直後の 1500ms 待ち中など）→ localStorage にのみ保存
    await store.savePresets(mk('A'))
    expect(brMem.has(KEY)).toBe(false)

    // 2) bridge 利用可能化 → 次の保存で pending(A) を bridge に flush してから B を書く
    bridgeReady = true
    await store.savePresets(mk('B'))

    // bridge には pending(A)→B の順で両方書かれ、最終値は B（再起動後も残る）
    expect(labelsOf(brWrites)).toEqual(['A', 'B'])
    expect(await store.loadPresets()).toEqual(mk('B'))
  })
})

describe('createPresetStore — 書き込み直列化', () => {
  test('連続 save が呼び出し順どおり書き込まれる（遅い先行 save が後続を追い越さない）', async () => {
    const writes: string[] = []
    const delays = [30, 20, 10] // 先行ほど遅い＝直列化が無いと完了順が逆転する
    let i = 0
    const bridge: PresetBridge = {
      async getLocalStorage() {
        return ''
      },
      async setLocalStorage(_key, value) {
        const d = delays[i++] ?? 0
        await new Promise((r) => setTimeout(r, d))
        writes.push(value)
      },
    }
    const store = createPresetStore({ getBridge: async () => bridge })
    await Promise.all([
      store.savePresets(mk('A')),
      store.savePresets(mk('B')),
      store.savePresets(mk('C')),
    ])
    expect(labelsOf(writes)).toEqual(['A', 'B', 'C'])
  })

  test('save 失敗（bridge throw）は握り潰され後続キューを壊さない', async () => {
    let calls = 0
    const writes: string[] = []
    const bridge: PresetBridge = {
      async getLocalStorage() {
        return ''
      },
      async setLocalStorage(_key, value) {
        calls++
        if (calls === 1) throw new Error('first save fails')
        writes.push(value)
      },
    }
    const store = createPresetStore({ getBridge: async () => bridge })
    await store.savePresets(mk('A')) // throw → 握り潰し
    await store.savePresets(mk('B')) // 後続は成功する
    expect(labelsOf(writes)).toEqual(['B'])
  })
})
