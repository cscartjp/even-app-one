import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import {
  type DesignParams,
  parseDesignParams,
  serializeDesignParams,
} from './types'

const DESIGN_PARAMS_KEY = 'ui-lab.designParams'
const BRIDGE_WAIT_MS = 1500

export interface StorageBridge {
  getLocalStorage(key: string): Promise<string>
  setLocalStorage(key: string, value: string): Promise<unknown>
}

export interface StorageLocalStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface DesignParamsStoreDeps {
  getBridge: () => Promise<StorageBridge | null>
  localStorage?: StorageLocalStorage
}

export interface DesignParamsStore {
  load(): Promise<DesignParams>
  save(params: DesignParams): Promise<void>
}

export function createDesignParamsStore(
  deps: DesignParamsStoreDeps,
): DesignParamsStore {
  const ls = (): StorageLocalStorage | undefined =>
    deps.localStorage ?? globalThis.localStorage
  let saveQueue: Promise<void> = Promise.resolve()
  let pendingBridgeSync: string | null = null

  const safeGetItem = () => {
    try {
      return ls()?.getItem(DESIGN_PARAMS_KEY) ?? null
    } catch {
      return null
    }
  }

  return {
    async load() {
      try {
        const bridge = await deps.getBridge()
        if (bridge) {
          const fromBridge = await bridge.getLocalStorage(DESIGN_PARAMS_KEY)
          if (fromBridge) return parseDesignParams(fromBridge)

          const fromLocal = safeGetItem()
          if (fromLocal) {
            try {
              await bridge.setLocalStorage(DESIGN_PARAMS_KEY, fromLocal)
            } catch {
              // Keep local fallback as the source for this load.
            }
            return parseDesignParams(fromLocal)
          }
          return parseDesignParams('')
        }
        return parseDesignParams(safeGetItem() ?? '')
      } catch {
        return parseDesignParams(safeGetItem() ?? '')
      }
    },

    save(params) {
      const serialized = serializeDesignParams(params)
      saveQueue = saveQueue.then(async () => {
        try {
          const bridge = await deps.getBridge()
          if (bridge) {
            if (pendingBridgeSync !== null) {
              await bridge.setLocalStorage(DESIGN_PARAMS_KEY, pendingBridgeSync)
              pendingBridgeSync = null
            }
            await bridge.setLocalStorage(DESIGN_PARAMS_KEY, serialized)
            return
          }
          ls()?.setItem(DESIGN_PARAMS_KEY, serialized)
          pendingBridgeSync = serialized
        } catch {
          try {
            ls()?.setItem(DESIGN_PARAMS_KEY, serialized)
            pendingBridgeSync = serialized
          } catch {
            // State in React remains the immediate cache if persistence fails.
          }
        }
      })
      return saveQueue
    },
  }
}

let bridgePromise: Promise<Awaited<
  ReturnType<typeof waitForEvenAppBridge>
> | null> | null = null

async function tryGetBridge(): Promise<StorageBridge | null> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    if (!bridgePromise) bridgePromise = waitForEvenAppBridge()
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => resolve(null), BRIDGE_WAIT_MS)
    })
    return await Promise.race([bridgePromise, timeoutPromise])
  } catch {
    bridgePromise = null
    return null
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId)
  }
}

const productionStore = createDesignParamsStore({ getBridge: tryGetBridge })

export const loadDesignParams = (): Promise<DesignParams> =>
  productionStore.load()

export const saveDesignParams = (params: DesignParams): Promise<void> =>
  productionStore.save(params)
