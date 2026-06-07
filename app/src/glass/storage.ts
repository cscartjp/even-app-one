/**
 * 駅名永続化モジュール。
 *
 * Even Hub SDK の bridge.setLocalStorage / bridge.getLocalStorage を正本として使う。
 * bridge が存在しない環境（シミュレーター / vite dev / preview）では
 * ブラウザ localStorage にフォールバックする（dev 専用の保険。本番環境では bridge が必須）。
 */
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'

/** ストレージキー */
const STATION_KEY = 'hisho.station'

/**
 * bridge インスタンスの取得を 1 度だけ行うための Promise キャッシュ。
 * null にリセットされた場合は次回呼び出しで再試行する。
 */
let bridgePromise: Promise<
  Awaited<ReturnType<typeof waitForEvenAppBridge>>
> | null = null

/** bridge の取得を試みる。失敗またはタイムアウト時は null を返す（フォールバック判定用） */
async function tryGetBridge(): Promise<Awaited<
  ReturnType<typeof waitForEvenAppBridge>
> | null> {
  try {
    if (!bridgePromise) {
      bridgePromise = waitForEvenAppBridge()
    }
    // dev/シミュレーター環境では waitForEvenAppBridge が永久 pending になる場合があるため
    // 1500ms でタイムアウトしてブラウザ localStorage フォールバックへ落とす
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<null>((resolve) => {
      timeoutId = setTimeout(() => {
        // タイムアウト時は Promise キャッシュを破棄して次回再試行できるようにする
        bridgePromise = null
        resolve(null)
      }, 1500)
    })
    const result = await Promise.race([bridgePromise, timeoutPromise])
    if (timeoutId !== null) clearTimeout(timeoutId)
    return result
  } catch {
    // bridge 初期化が reject された場合もフォールバックへ
    bridgePromise = null
    return null
  }
}

/**
 * 保存済み駅名を読む。
 * - bridge が存在する場合: SDK localStorage から読む（未設定キーは "" が返るため null に変換）
 * - bridge が存在しない場合: ブラウザ localStorage から読む（dev 専用フォールバック）
 * @returns 保存済みの駅名。未設定（空文字列含む）の場合は null
 */
export async function loadStationName(): Promise<string | null> {
  try {
    const bridge = await tryGetBridge()
    if (bridge) {
      const raw = await bridge.getLocalStorage(STATION_KEY)
      // 未設定キーは "" が返る。空文字列は「自動モード」を意味するため null として扱う
      return raw === '' ? null : raw
    }
    // dev フォールバック: ブラウザ localStorage を使う（シミュレーター / vite dev / preview 環境）
    // getItem は未存在キーで null、手動で "" を書いた場合も「自動モード」扱いとする
    return localStorage.getItem(STATION_KEY) || null
  } catch {
    return null
  }
}

/**
 * 駅名を保存する。
 * - name が null の場合は空文字列 "" を書き込む（「自動モードに戻す」操作）。
 *   SDK に removeLocalStorage は存在しないため、空文字列でリセットを表現する。
 * - bridge が存在する場合: SDK localStorage に書く
 * - bridge が存在しない場合: ブラウザ localStorage に書く（dev 専用フォールバック）
 * @param name 保存する駅名。null は「自動モードに戻す」
 */
export async function saveStationName(name: string | null): Promise<void> {
  const value = name ?? ''
  try {
    const bridge = await tryGetBridge()
    if (bridge) {
      await bridge.setLocalStorage(STATION_KEY, value)
      return
    }
    // dev フォールバック: ブラウザ localStorage を使う（シミュレーター / vite dev / preview 環境）
    localStorage.setItem(STATION_KEY, value)
  } catch {
    // bridge 呼び出しが失敗した場合は握りつぶす（呼び出し側の state がキャッシュを兼ねる）
  }
}
