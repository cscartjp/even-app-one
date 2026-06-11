/**
 * コンパニオンの永続化モジュール（presets + settings）。
 *
 * 正本 = Even Hub SDK の bridge.setLocalStorage / getLocalStorage。bridge 不在環境
 * （ブラウザ dev / シミュレーター / プレビュー）では browser localStorage へフォールバックする。
 * 値はキーごとに JSON 文字列 1 本で保存し、全件 1 キー上書きで「削除」も表現する
 * （SDK に removeLocalStorage が無いため）。検証 / default フォールバックは各モジュールの
 * parse() に委譲する（黙って壊さない）。
 *
 * presets と settings は **別キー**（`g2hermes.presets` / `g2hermes.settings`）で保存し、
 * 共通の JSON ストア（createJsonStore）に bridge キャッシュ・1500ms タイムアウト・
 * 書き込み直列化キュー・bridge 復帰時の再同期ロジックを集約する。
 */
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { type Preset, parse, serialize } from './presets'
import { parseSettings, type Settings, serializeSettings } from './settings'

/** 永続化キー。 */
const PRESETS_KEY = 'g2hermes.presets'
const SETTINGS_KEY = 'g2hermes.settings'

/** dev / シミュレーターで waitForEvenAppBridge が永久 pending になる場合の諦め時間。 */
const BRIDGE_WAIT_MS = 1500

/** storage が依存する bridge の最小インターフェース（テストでモック注入する）。 */
export interface StorageBridge {
  getLocalStorage(key: string): Promise<string>
  // 実 SDK は Promise<boolean> を返すが保存可否は使わないため戻り値非依存にする。
  setLocalStorage(key: string, value: string): Promise<unknown>
}

/** dev フォールバックで使う localStorage の最小インターフェース。 */
export interface StorageLocalStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface StorageDeps {
  /** bridge 取得。不在 / タイムアウト時は null を返す（production は下記 tryGetBridge）。 */
  getBridge: () => Promise<StorageBridge | null>
  /** dev フォールバック。省略時は global localStorage を使う。 */
  localStorage?: StorageLocalStorage
}

// 後方互換エイリアス（既存テスト / import を壊さない）。
export type PresetBridge = StorageBridge
export type PresetLocalStorage = StorageLocalStorage
export type PresetStoreDeps = StorageDeps

/** 1 キー = 1 JSON 値のストア（load / save）。直列化はこのインスタンスに閉じる。 */
interface JsonStore<T> {
  load(): Promise<T>
  save(value: T): Promise<void>
}

/**
 * key ごとの JSON ストアを作る。bridge 優先・不在時は localStorage フォールバック、
 * 書き込み直列化、bridge 復帰時の pending 再同期を担う。parse/serialize は呼び出し側が渡す。
 */
function createJsonStore<T>(
  key: string,
  parseValue: (raw: string) => T,
  serializeValue: (value: T) => string,
  deps: StorageDeps,
): JsonStore<T> {
  const ls = (): StorageLocalStorage =>
    deps.localStorage ?? globalThis.localStorage
  // localStorage の安全な読み出し（未提供環境では null）。bridge 空時の fallback 確認に使う。
  const safeGetItem = (k: string): string | null => {
    try {
      const store = deps.localStorage ?? globalThis.localStorage
      return store ? store.getItem(k) : null
    } catch {
      return null
    }
  }
  // 書き込み直列化キュー。連続編集で save が並列に呼ばれても呼び出し順を保つ。
  let saveQueue: Promise<void> = Promise.resolve()
  // bridge 未取得時に localStorage へ退避した最新値。bridge が遅れて利用可能になったら
  // 次の保存でこれを先に bridge へ流し、起動直後（1500ms 待ち中）の編集が bridge に
  // 同期されず再起動で消えるのを防ぐ。bridge 取得後に保存が続く限り解消する。
  let pendingBridgeSync: string | null = null

  return {
    async load(): Promise<T> {
      try {
        const bridge = await deps.getBridge()
        if (bridge) {
          const fromBridge = await bridge.getLocalStorage(key)
          if (fromBridge) return parseValue(fromBridge)
          // bridge にまだ無い → 起動直後の bridge タイムアウト中に localStorage だけへ
          // フォールバック保存された値が、後の起動（bridge が即利用可）で bridge の空値に
          // 負けて失われるのを防ぐ。localStorage に残っていれば採用し bridge へ移送する（Codex P2）。
          const fromLocal = safeGetItem(key)
          if (fromLocal) {
            try {
              await bridge.setLocalStorage(key, fromLocal)
            } catch {
              // 移送失敗は無視（次回再試行・今回は localStorage 値を採用）。
            }
            return parseValue(fromLocal)
          }
          return parseValue('')
        }
        // bridge 不在は localStorage フォールバック（未設定は parse('') で default）。
        return parseValue(safeGetItem(key) ?? '')
      } catch {
        return parseValue('')
      }
    },

    save(value: T): Promise<void> {
      const serialized = serializeValue(value)
      saveQueue = saveQueue.then(async () => {
        try {
          const bridge = await deps.getBridge()
          if (bridge) {
            // bridge 不在中に localStorage へ退避した分があれば先に同期してから今回値を書く。
            if (pendingBridgeSync !== null) {
              await bridge.setLocalStorage(key, pendingBridgeSync)
              pendingBridgeSync = null
            }
            await bridge.setLocalStorage(key, serialized)
            return
          }
          ls().setItem(key, serialized)
          // bridge が後で利用可能になったときに flush する最新値として覚えておく。
          pendingBridgeSync = serialized
        } catch {
          // 失敗は握り潰す（state がキャッシュを兼ね次回起動で再試行）。
          // チェーン内で吸収して後続キューを壊さない。
        }
      })
      return saveQueue
    },
  }
}

export interface PresetStore {
  /** 保存済み presets を読む（未設定 / 不正は default seed）。起動時プリロードで 1 回呼ぶ想定。 */
  loadPresets(): Promise<Preset[]>
  /** presets を全件 1 キー上書きで保存する（write-through・直列化）。 */
  savePresets(presets: Preset[]): Promise<void>
}

/**
 * 注入された依存から PresetStore を作る。
 * 直列化キューはこのインスタンスに閉じるため、テストは store ごとに独立した順序保証を持つ。
 */
export function createPresetStore(deps: StorageDeps): PresetStore {
  const store = createJsonStore<Preset[]>(PRESETS_KEY, parse, serialize, deps)
  return {
    loadPresets: () => store.load(),
    savePresets: (presets) => store.save(presets),
  }
}

export interface SettingsStore {
  /** 保存済み settings を読む（未設定 / 不正は DEFAULT_SETTINGS=OFF）。 */
  loadSettings(): Promise<Settings>
  /** settings を保存する（write-through・直列化・presets と別キー）。 */
  saveSettings(settings: Settings): Promise<void>
}

/** 注入された依存から SettingsStore を作る（presets と別キー `g2hermes.settings`）。 */
export function createSettingsStore(deps: StorageDeps): SettingsStore {
  const store = createJsonStore<Settings>(
    SETTINGS_KEY,
    parseSettings,
    serializeSettings,
    deps,
  )
  return {
    loadSettings: () => store.load(),
    saveSettings: (settings) => store.save(settings),
  }
}

/** bridge 取得を 1 度だけ行うための Promise キャッシュ。 */
let bridgePromise: Promise<Awaited<
  ReturnType<typeof waitForEvenAppBridge>
> | null> | null = null

/**
 * production 用の bridge 取得。1500ms でタイムアウトして localStorage フォールバックへ落とす。
 * タイムアウトしても bridgePromise は保持し、遅れて resolve した場合に以降の呼び出しで使えるようにする。
 */
async function tryGetBridge(): Promise<StorageBridge | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    if (!bridgePromise) bridgePromise = waitForEvenAppBridge()
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), BRIDGE_WAIT_MS)
    })
    // race が reject しても finally でタイマーを必ず解除する（reject 経路の timer leak 防止）。
    return await Promise.race([bridgePromise, timeoutPromise])
  } catch {
    bridgePromise = null
    return null
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}

/** production singletons（実 bridge + global localStorage）。presets / settings は別キー。 */
const productionPresetStore = createPresetStore({ getBridge: tryGetBridge })
const productionSettingsStore = createSettingsStore({ getBridge: tryGetBridge })

/** 保存済み presets を読む（App 起動時プリロード用）。 */
export const loadPresets = (): Promise<Preset[]> =>
  productionPresetStore.loadPresets()
/** presets を保存する（write-through・直列化）。 */
export const savePresets = (presets: Preset[]): Promise<void> =>
  productionPresetStore.savePresets(presets)
/** 保存済み settings を読む（App 起動時プリロード用・既定 OFF）。 */
export const loadSettings = (): Promise<Settings> =>
  productionSettingsStore.loadSettings()
/** settings を保存する（write-through・直列化）。 */
export const saveSettings = (settings: Settings): Promise<void> =>
  productionSettingsStore.saveSettings(settings)
