import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'

// ブリッジが注入されない環境（ブラウザプレビュー・シミュレーター）では
// waitForEvenAppBridge() が解決しないことがあるため、この時間で諦める。
// これが無いと Exit が pending のままハングする。
const BRIDGE_WAIT_MS = 1500

/**
 * アプリ終了。ネイティブの終了確認ダイアログ（exitMode=1）を表示する。
 * useGlasses(even-toolkit) は表示専用に使い `shutdownOnHomeBack:false` にしているため、
 * 終了は GO_BACK / Exit から明示的にここで SDK を叩く（仕様書 §3.3）。
 * SDK が無い/注入されないプレビュー・シミュレーターでは黙ってスキップする。
 */
export async function requestExit(): Promise<void> {
  try {
    const bridge = await Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), BRIDGE_WAIT_MS),
      ),
    ])
    if (!bridge) return
    await bridge.shutDownPageContainer(1)
  } catch {
    // SDK エラーは黙殺（グラス未接続のプレビュー等）
  }
}
