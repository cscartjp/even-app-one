import {
  OsEventTypeList,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'

// 前面/背面ライフサイクル監視（Task 3.4.2・spec §4.5）。
// SDK 0.0.10 には新 SDK の setBackgroundState/onBackgroundRestore（ヘッドレス移行）が
// 無いため、`sysEvent.eventType` の FOREGROUND_ENTER/EXIT で前面復帰・背面化を検知する。
// useGlasses はこれらを転送しないので SDK 直購読する（mic-probe で実機併用を実証済み）。
// `window` 依存の WebView 専用モジュールとして even/ 配下に隔離する。

const BRIDGE_WAIT_MS = 1500

export interface LifecycleHandlers {
  /** 前面復帰（FOREGROUND_ENTER_EVENT）時に呼ぶ。具体的な処理は呼び出し側で決める。 */
  onForeground: () => void
  /** 背面化（FOREGROUND_EXIT_EVENT）時に呼ぶ。具体的な処理は呼び出し側で決める。 */
  onBackground: () => void
}

export interface LifecycleHandle {
  stop: () => void
}

/**
 * 前面/背面イベントの購読を開始する。SDK が無い環境（プレビュー/シミュレーター）では
 * 何もしないハンドルを返す（bridge.ts と同じ諦め方）。
 */
export async function watchLifecycle(
  handlers: LifecycleHandlers,
): Promise<LifecycleHandle> {
  const bridge = await Promise.race([
    waitForEvenAppBridge(),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), BRIDGE_WAIT_MS),
    ),
  ])
  if (!bridge) return { stop: () => {} }

  const unsubscribe = bridge.onEvenHubEvent((event) => {
    const t = event.sysEvent?.eventType
    if (t === OsEventTypeList.FOREGROUND_ENTER_EVENT) handlers.onForeground()
    else if (t === OsEventTypeList.FOREGROUND_EXIT_EVENT)
      handlers.onBackground()
  })
  return { stop: () => unsubscribe() }
}
