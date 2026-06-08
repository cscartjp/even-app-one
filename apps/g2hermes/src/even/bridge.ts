import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'

/**
 * アプリ終了。ネイティブの終了確認ダイアログ（exitMode=1）を表示する。
 * useGlasses(even-toolkit) は表示専用に使い `shutdownOnHomeBack:false` にしているため、
 * 終了は GO_BACK / Exit から明示的にここで SDK を叩く（仕様書 §3.3）。
 * ブラウザプレビュー等で SDK が無い場合は黙って何もしない。
 */
export async function requestExit(): Promise<void> {
  try {
    const bridge = await waitForEvenAppBridge()
    await bridge.shutDownPageContainer(1)
  } catch {
    // SDK 不在 — グラス未接続のプレビューでは終了不要
  }
}
