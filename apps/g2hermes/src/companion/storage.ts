/**
 * コンパニオン カスタム質問の永続化モジュール。
 *
 * 正本 = Even Hub SDK の bridge.setLocalStorage / getLocalStorage。bridge 不在環境
 * （ブラウザ dev / シミュレーター / プレビュー）では browser localStorage へフォールバックする。
 * presets は配列なのでキー `g2hermes.presets` に JSON 文字列 1 本で保存し、全件 1 キー上書きで
 * 「削除（件数減）」も表現する（SDK に removeLocalStorage が無いため）。
 * 検証 / default フォールバックは presets.ts の parse() に委譲する（黙って壊さない）。
 *
 * hisho `glass/storage.ts` の bridge キャッシュ・1500ms タイムアウト・書き込み直列化キューを
 * 踏襲しつつ、配列 + JSON + テスト注入（createPresetStore）の分だけ拡張している。
 */
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { type Preset, parse, serialize } from './presets'

/** 永続化キー。 */
const PRESETS_KEY = 'g2hermes.presets'

/** dev / シミュレーターで waitForEvenAppBridge が永久 pending になる場合の諦め時間。 */
const BRIDGE_WAIT_MS = 1500

/** storage が依存する bridge の最小インターフェース（テストでモック注入する）。 */
export interface PresetBridge {
  getLocalStorage(key: string): Promise<string>
  // 実 SDK は Promise<boolean> を返すが保存可否は使わないため戻り値非依存にする。
  setLocalStorage(key: string, value: string): Promise<unknown>
}

/** dev フォールバックで使う localStorage の最小インターフェース。 */
export interface PresetLocalStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface PresetStore {
  /** 保存済み presets を読む（未設定 / 不正は default seed）。起動時プリロードで 1 回呼ぶ想定。 */
  loadPresets(): Promise<Preset[]>
  /** presets を全件 1 キー上書きで保存する（write-through・直列化）。 */
  savePresets(presets: Preset[]): Promise<void>
}

export interface PresetStoreDeps {
  /** bridge 取得。不在 / タイムアウト時は null を返す（production は下記 tryGetBridge）。 */
  getBridge: () => Promise<PresetBridge | null>
  /** dev フォールバック。省略時は global localStorage を使う。 */
  localStorage?: PresetLocalStorage
}

/**
 * 注入された依存から PresetStore を作る。
 * 直列化キューはこのインスタンスに閉じるため、テストは store ごとに独立した順序保証を持つ。
 */
export function createPresetStore(deps: PresetStoreDeps): PresetStore {
  const ls = (): PresetLocalStorage =>
    deps.localStorage ?? globalThis.localStorage
  // 書き込み直列化キュー。連続編集で savePresets が並列に呼ばれても呼び出し順を保つ（hisho 踏襲）。
  let saveQueue: Promise<void> = Promise.resolve()

  return {
    async loadPresets(): Promise<Preset[]> {
      try {
        const bridge = await deps.getBridge()
        const raw = bridge
          ? await bridge.getLocalStorage(PRESETS_KEY)
          : ls().getItem(PRESETS_KEY)
        // 未設定キーは bridge が ""・localStorage が null。どちらも parse('') で default seed になる。
        return parse(raw ?? '')
      } catch {
        return parse('')
      }
    },

    savePresets(presets: Preset[]): Promise<void> {
      const value = serialize(presets)
      saveQueue = saveQueue.then(async () => {
        try {
          const bridge = await deps.getBridge()
          if (bridge) {
            await bridge.setLocalStorage(PRESETS_KEY, value)
            return
          }
          ls().setItem(PRESETS_KEY, value)
        } catch {
          // 失敗は握り潰す（state がキャッシュを兼ね次回起動で再試行）。
          // チェーン内で吸収して後続キューを壊さない。
        }
      })
      return saveQueue
    },
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
async function tryGetBridge(): Promise<PresetBridge | null> {
  try {
    if (!bridgePromise) bridgePromise = waitForEvenAppBridge()
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), BRIDGE_WAIT_MS)
    })
    const result = await Promise.race([bridgePromise, timeoutPromise])
    if (timeoutId !== null) clearTimeout(timeoutId)
    return result
  } catch {
    bridgePromise = null
    return null
  }
}

/** production singleton（実 bridge + global localStorage）。 */
const productionStore = createPresetStore({ getBridge: tryGetBridge })

/** 保存済み presets を読む（App 起動時プリロード用）。 */
export const loadPresets = (): Promise<Preset[]> =>
  productionStore.loadPresets()
/** presets を保存する（write-through・直列化）。 */
export const savePresets = (presets: Preset[]): Promise<void> =>
  productionStore.savePresets(presets)
