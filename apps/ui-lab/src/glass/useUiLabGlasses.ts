import {
  RebuildPageContainer,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'
import { mapGlassEvent } from 'even-toolkit/action-map'
import { EvenHubBridge } from 'even-toolkit/bridge'
import { notifyTextUpdate } from 'even-toolkit/gestures'
import { activateKeepAlive, deactivateKeepAlive } from 'even-toolkit/keep-alive'
import { bindKeyboard } from 'even-toolkit/keyboard'
import type { GlassAction } from 'even-toolkit/types'
import { useCallback, useEffect, useRef } from 'react'
import type { DesignParams } from '../params/types'
import { buildContainers, type CardContainerConfig } from './buildContainers'

const DEBOUNCE_MS = 40

function rawPage(configs: CardContainerConfig[]): RebuildPageContainer {
  return new RebuildPageContainer({
    containerTotalNum: configs.length,
    textObject: configs.map(
      (c) =>
        new TextContainerProperty({
          containerID: c.containerID,
          containerName: c.containerName,
          xPosition: c.xPosition,
          yPosition: c.yPosition,
          width: c.width,
          height: c.height,
          borderWidth: c.borderWidth,
          borderColor: c.borderColor,
          borderRadius: c.borderRadius,
          paddingLength: c.paddingLength,
          content: c.content,
          isEventCapture: c.isEventCapture,
        }),
    ),
  })
}

export interface UseUiLabGlassesConfig {
  params: DesignParams
  onParamsChange: (params: DesignParams) => void
}

export function useUiLabGlasses(config: UseUiLabGlassesConfig): void {
  const params = config.params
  const hubRef = useRef<EvenHubBridge | null>(null)
  const configRef = useRef(config)
  const selectedIndexRef = useRef(1)
  const busyRef = useRef(false)
  const pendingRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderErrorLoggedRef = useRef(false)
  configRef.current = config

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
      const configs = buildContainers(configRef.current.params, {
        selectedIndex: selectedIndexRef.current,
      })
      await hub.rawBridge.rebuildPageContainer(rawPage(configs))
      notifyTextUpdate()
    } catch (err) {
      if (!renderErrorLoggedRef.current) {
        renderErrorLoggedRef.current = true
        console.error('[useUiLabGlasses] glass render failed', err)
      }
    } finally {
      busyRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        void render()
      }
    }
  }, [])

  const scheduleRender = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void render()
    }, DEBOUNCE_MS)
  }, [render])

  const handleAction = useCallback(
    (action: GlassAction) => {
      if (action.type === 'HIGHLIGHT_MOVE') {
        selectedIndexRef.current += action.direction === 'down' ? 1 : -1
        void render()
        return
      }
      if (action.type === 'SELECT_HIGHLIGHTED') {
        const params = configRef.current.params
        configRef.current.onParamsChange({ ...params, modal: !params.modal })
      }
    },
    [render],
  )

  useEffect(() => {
    void params
    scheduleRender()
  }, [params, scheduleRender])

  useEffect(() => {
    let disposed = false
    const hub = new EvenHubBridge()
    hubRef.current = hub

    async function init() {
      try {
        await hub.init()
        ;(window as unknown as { __evenBridge: EvenHubBridge }).__evenBridge =
          hub
        if (disposed) return
        await hub.showTextPage('\n\n      UI LAB')
        if (disposed) return
        hub.onEvent((event) => {
          const action = mapGlassEvent(event)
          if (action) handleAction(action)
        })
      } catch {
        // SDK 未提供（通常ブラウザ）ではスマホ companion のみ継続する。
      }
      if (disposed || !hub.rawBridge) return
      void render()
    }

    init()
    const unbindKeyboard = bindKeyboard(handleAction)
    activateKeepAlive('UI_LAB_keep_alive')

    return () => {
      disposed = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      unbindKeyboard()
      hub.dispose()
      hubRef.current = null
      ;(
        window as unknown as { __evenBridge: EvenHubBridge | null }
      ).__evenBridge = null
      deactivateKeepAlive()
    }
  }, [handleAction, render])
}
