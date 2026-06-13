import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'

// ブリッジが注入されない環境（ブラウザプレビュー）では waitForEvenAppBridge() が
// 解決しないため、この時間で諦める（g2hermes 踏襲）。
const BRIDGE_WAIT_MS = 1500

/**
 * アプリ終了。ネイティブの終了確認ダイアログ（exitMode=1）を表示する。
 * SDK が無い/注入されないプレビューでは黙ってスキップする。
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
