import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line } from 'even-toolkit/types'
import { glassLines } from '../imu/glass'
import type { LabState } from '../imu/state'

/**
 * アプリ版を返す（正本は app.json の version、Vite define で注入）。
 * bun test など Vite を介さない実行は '0.0.0-dev' にフォールバック。
 */
export function appVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev'
}

/** グラス側の操作（実体は AppGlasses が useImu/exit を配線）。 */
export interface Ctx {
  /** タップ: 計測 ON/OFF。 */
  toggle: () => void
  /** スクロール: pace を循環。 */
  cyclePace: (dir: 'up' | 'down') => void
  /** ダブルタップ: 終了。 */
  exit: () => void
}

/**
 * IMU Lab の単一画面。計測値を数行で出すだけの副ディスプレイ。
 * 入力は 3 アクション（タップ=計測 ON/OFF、↕=pace 切替、ダブルタップ=終了）。
 */
export const labScreen: GlassScreen<LabState, Ctx> = {
  display(s) {
    const lines = glassLines(s, appVersion())
    return {
      lines: [
        line(lines[0]),
        line('', 'separator'),
        line(lines[1]),
        line(lines[2]),
        line(lines[3]),
        line(lines[4]),
        line(lines[5], 'meta'),
      ],
    }
  },

  action(action, nav, _s, ctx) {
    if (action.type === 'SELECT_HIGHLIGHTED') {
      ctx.toggle()
      return nav
    }
    if (action.type === 'HIGHLIGHT_MOVE') {
      ctx.cyclePace(action.direction === 'down' ? 'down' : 'up')
      return nav
    }
    if (action.type === 'GO_BACK') {
      // ダブルタップ: 終了
      ctx.exit()
    }
    // 想定外の action は無視（ダブルタップ以外で誤終了しないようにする）。
    return nav
  },
}
