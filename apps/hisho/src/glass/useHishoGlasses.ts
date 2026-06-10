import {
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { mapGlassEvent } from 'even-toolkit/action-map'
import { EvenHubBridge } from 'even-toolkit/bridge'
import { notifyTextUpdate } from 'even-toolkit/gestures'
import { activateKeepAlive, deactivateKeepAlive } from 'even-toolkit/keep-alive'
import { bindKeyboard } from 'even-toolkit/keyboard'
import type { GlassAction, GlassNavState } from 'even-toolkit/types'
import { renderTextPageLines } from 'even-toolkit/types'
import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router'
import {
  type CardContainerConfig,
  HOME_CONTAINER_ID,
  homeCardConfigs,
  homeCardModel,
} from './homeCards'
import { toDisplayData, toSplit } from './selectors'
import type { AppSnapshot } from './shared'

const DISPLAY_W = 576
const DISPLAY_H = 288
const TEXT_CONTAINER_ID = 2
const UPGRADE_MAX = 2000

type RenderKind = 'home' | 'split' | 'text'

function renderKind(screen: string): RenderKind {
  if (screen === 'home') return 'home'
  if (screen === 'gourmetNearby') return 'split'
  return 'text'
}

/** CardContainerConfig[] を raw SDK の rebuild ページに変換する */
function rawPage(configs: CardContainerConfig[]): RebuildPageContainer {
  return new RebuildPageContainer({
    containerTotalNum: configs.length,
    textObject: configs.map((c) => new TextContainerProperty(c)),
  })
}

/** テキスト画面用の最小コンテナ（オーバーレイ + 全面テキスト） */
function textConfigs(text: string): CardContainerConfig[] {
  return [
    {
      containerID: 1,
      containerName: 'overlay',
      xPosition: 0,
      yPosition: 0,
      width: DISPLAY_W,
      height: DISPLAY_H,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 0,
      content: '',
      isEventCapture: 1,
    },
    {
      containerID: TEXT_CONTAINER_ID,
      containerName: 'text',
      xPosition: 0,
      yPosition: 0,
      width: DISPLAY_W,
      height: DISPLAY_H,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 6,
      content: text,
      isEventCapture: 0,
    },
  ]
}

function upgrade(
  id: number,
  name: string,
  content: string,
): TextContainerUpgrade {
  return new TextContainerUpgrade({
    containerID: id,
    containerName: name,
    contentOffset: 0,
    contentLength: UPGRADE_MAX,
    content,
  })
}

export interface UseHishoGlassesConfig {
  getSnapshot: () => AppSnapshot
  onGlassAction: (
    action: GlassAction,
    nav: GlassNavState,
    snapshot: AppSnapshot,
  ) => GlassNavState
  deriveScreen: (path: string) => string
}

/**
 * 🃏 issue #37 Phase 6.2: Hisho 専用のグラス描画ドライバ。
 * even-toolkit `useGlasses` のホームは単一テキストコンテナ方式で角丸枠カードを
 * 注入できないため、ホーム/テキスト画面を raw SDK 直叩きで描画する。
 * split（gourmetNearby）の精密レイアウトは既存 `EvenHubBridge.show/updateSplitPage`
 * をそのまま再利用し、入力（onGlassAction）・events・shutdown も無改変で踏襲する。
 * 起動時に showTextPage で createStartUp を 1 回消化し、以降は rebuild に統一する
 * （二重 createStartUp / sdk 状態の desync を回避）。
 */
export function useHishoGlasses(config: UseHishoGlassesConfig): void {
  const location = useLocation()

  const hubRef = useRef<EvenHubBridge | null>(null)
  const navRef = useRef<GlassNavState>({ highlightedIndex: 0, screen: '' })
  const lastScreenRef = useRef<string>('')
  const lastSnapshotRef = useRef<AppSnapshot | null>(null)
  const configRef = useRef(config)
  configRef.current = config

  // 描画の直列化（重ねがけ防止）。描画中の要求は pending にまとめて 1 回だけ追従する
  const busyRef = useRef(false)
  const pendingRef = useRef(false)
  // 描画失敗のログは初回だけ出す（poll は 100ms 間隔のため spam を避ける）
  const renderErrorLoggedRef = useRef(false)

  const render = useCallback(async () => {
    const hub = hubRef.current
    if (!hub?.rawBridge) return
    if (busyRef.current) {
      pendingRef.current = true
      return
    }
    busyRef.current = true
    pendingRef.current = false
    try {
      const snapshot = configRef.current.getSnapshot()
      const nav = navRef.current
      const kind = renderKind(nav.screen)
      const enter = nav.screen !== lastScreenRef.current

      if (kind === 'split') {
        const split = toSplit(snapshot, nav)
        if (enter || hub.currentMode !== 'split') {
          await hub.showSplitPage(split.header, split.panes, split.layout)
        } else {
          await hub.updateSplitPage(split.header, split.panes, split.layout)
        }
      } else if (kind === 'home') {
        const model = homeCardModel(
          snapshot.origin,
          snapshot.selectedStation,
          nav.highlightedIndex,
        )
        const configs = homeCardConfigs(model)
        if (enter) {
          await hub.rawBridge.rebuildPageContainer(rawPage(configs))
        } else {
          // 無ちらつき更新: content を持つコンテナだけ textContainerUpgrade
          await Promise.all(
            configs
              .filter((c) => c.containerID !== HOME_CONTAINER_ID.overlay)
              .map((c) =>
                hub.rawBridge?.textContainerUpgrade(
                  upgrade(c.containerID, c.containerName, c.content),
                ),
              ),
          )
        }
        notifyTextUpdate()
      } else {
        const text = renderTextPageLines(toDisplayData(snapshot, nav).lines)
        if (enter) {
          await hub.rawBridge.rebuildPageContainer(rawPage(textConfigs(text)))
        } else {
          await hub.rawBridge.textContainerUpgrade(
            upgrade(TEXT_CONTAINER_ID, 'text', text),
          )
        }
        notifyTextUpdate()
      }
      lastScreenRef.current = nav.screen
    } catch (err) {
      // 冒頭で rawBridge を guard 済みなので、ここに来るのは SDK 不在ではなく
      // 実描画の失敗（API 仕様変更/不正 payload 等）。初回だけログして追跡可能にする
      if (!renderErrorLoggedRef.current) {
        renderErrorLoggedRef.current = true
        console.error('[useHishoGlasses] glass render failed', err)
      }
    } finally {
      busyRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        void render()
      }
    }
  }, [])

  const handleAction = useCallback(
    (action: GlassAction) => {
      // 非同期本体は try/catch で包む（未処理の promise rejection を防ぐ。
      // 失敗しても握りつぶし、次の入力で回復できるようにする）
      void (async () => {
        try {
          // ホームでのダブルタップ（GO_BACK）はネイティブ shutdown を開く
          if (
            action.type === 'GO_BACK' &&
            renderKind(navRef.current.screen) === 'home'
          ) {
            await hubRef.current?.showShutdownContainer(1)
            return
          }
          const snapshot = configRef.current.getSnapshot()
          navRef.current = configRef.current.onGlassAction(
            action,
            navRef.current,
            snapshot,
          )
          void render()
        } catch {
          // 入力処理の失敗は無視（次の入力で回復する）
        }
      })()
    },
    [render],
  )

  // URL 変化で画面を切り替え、選択を先頭に戻して再描画
  useEffect(() => {
    const screen = configRef.current.deriveScreen(location.pathname)
    if (screen !== navRef.current.screen) {
      navRef.current = { highlightedIndex: 0, screen }
      void render()
    }
  }, [location.pathname, render])

  // ブリッジ初期化・イベント購読・ポーリング（マウント時 1 回のみ）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化はマウント/アンマウント時の 1 回のみ。handleAction/render/location.pathname を依存に入れるとブリッジが再生成されるため意図的に追わない（location は別 effect で監視）
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let disposed = false
    const hub = new EvenHubBridge()
    hubRef.current = hub
    navRef.current = {
      highlightedIndex: 0,
      screen: configRef.current.deriveScreen(location.pathname),
    }
    lastScreenRef.current = ''

    async function init() {
      try {
        await hub.init()
        // STT GlassBridgeSource 等のためグローバル公開（even-toolkit 互換）
        ;(window as unknown as { __evenBridge: EvenHubBridge }).__evenBridge =
          hub
        if (disposed) return
        // createStartUp を 1 回だけ消化（以降の raw rebuild を有効化）
        await hub.showTextPage('\n\n      HISHO')
        if (disposed) return
        hub.onEvent((event) => {
          const action = mapGlassEvent(event)
          if (action) handleAction(action)
        })
      } catch {
        // SDK 未提供（Web のみ）— グラス無しで継続
      }
      if (disposed) return
      // raw SDK が無い（Web プレビュー等）環境では描画もポーリングもしない
      // （無駄な 10Hz の no-op ポーリングを避ける）
      if (!hub.rawBridge) return
      void render()
      pollTimer = setInterval(() => {
        const snapshot = configRef.current.getSnapshot()
        if (snapshot !== lastSnapshotRef.current) {
          lastSnapshotRef.current = snapshot
          void render()
        }
      }, 100)
    }

    init()
    const unbindKeyboard = bindKeyboard(handleAction)
    activateKeepAlive('HISHO_keep_alive')

    return () => {
      disposed = true
      if (pollTimer) clearInterval(pollTimer)
      unbindKeyboard()
      hub.dispose()
      hubRef.current = null
      ;(
        window as unknown as { __evenBridge: EvenHubBridge | null }
      ).__evenBridge = null
      deactivateKeepAlive()
    }
  }, [])
}
