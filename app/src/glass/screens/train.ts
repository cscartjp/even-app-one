import { getTextWidth } from '@evenrealities/pretext'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line } from 'even-toolkit/types'
import { nearestStation } from '../../data/stations'
import {
  type Departure,
  formatDeparture,
  getNextDepartures,
} from '../../data/timetable'
import { type AppActions, type AppSnapshot, statusBarLine } from '../shared'

/**
 * 左カラムの目標幅 (px)。DASH_PX=20 の倍数にして ┼ と │ を同一ピクセル位置に揃える。
 * 最長パターン「HH:MM   99分後 ★」≈158px のため 160px（= 20×8）を採用。
 */
const LEFT_COL_TARGET_PX = 160
const SPACE_PX = getTextWidth(' ')
const DASH_PX = getTextWidth('─')

/** 左カラムテキストを LEFT_COL_TARGET_PX に揃える（末尾スペースで右パディング） */
function padLeft(text: string): string {
  const spaces = Math.max(
    1,
    Math.ceil((LEFT_COL_TARGET_PX - getTextWidth(text)) / SPACE_PX),
  )
  return text + ' '.repeat(spaces)
}

/** 1行の2カラム行を生成する: left │ right */
function twoColLine(leftText: string, rightText: string): string {
  return `${padLeft(leftText)}│ ${rightText}`
}

/**
 * 左カラム用フォーマット。
 * - 分数を2桁右揃え（1桁なら前に半角スペース1つ）
 * - 種別マークを分後テキストの後ろに付ける
 */
function formatLeft(dep: Departure): string {
  const mark = dep.ltdExpress ? '◆' : dep.express ? '★' : ''
  if (dep.minutesLeft === 0) {
    return mark ? `${dep.time}  まもなく ${mark}` : `${dep.time}  まもなく`
  }
  const minStr =
    dep.minutesLeft < 10 ? ` ${dep.minutesLeft}分後` : `${dep.minutesLeft}分後`
  return mark ? `${dep.time}  ${minStr} ${mark}` : `${dep.time}  ${minStr}`
}

/**
 * 右カラム用フォーマット。
 * モックに合わせ「HH:MM 行き先 分後」（1スペース区切り）。
 * 種別マークは分後テキストの後ろ（左カラムと同じ配置）。
 */
function formatRight(dep: Departure): string {
  const mark = dep.ltdExpress ? '◆' : dep.express ? '★' : ''
  const minStr = dep.minutesLeft === 0 ? 'まもなく' : `${dep.minutesLeft}分後`
  if (dep.dest) {
    return mark
      ? `${dep.time} ${dep.dest} ${minStr} ${mark}`
      : `${dep.time} ${dep.dest} ${minStr}`
  }
  return mark ? `${dep.time} ${minStr} ${mark}` : `${dep.time}  ${minStr}`
}

/**
 * 2カラム罫線を生成する。
 * LEFT_COL_TARGET_PX は DASH_PX の倍数なので leftDashes は整数（floor 不要）。
 * ┼ x 位置 = leftDashes × DASH_PX = LEFT_COL_TARGET_PX （正確に一致）。
 */
function buildSeparator(rightDeps: Departure[]): string {
  const leftDashes = LEFT_COL_TARGET_PX / DASH_PX // 整数（160/20=8）
  const maxRightPx = Math.max(
    ...rightDeps.map((d) => getTextWidth(` ${formatRight(d)}`)),
    0,
  )
  const rightDashes = Math.max(1, Math.ceil(maxRightPx / DASH_PX))
  return `${'─'.repeat(leftDashes)}┼${'─'.repeat(rightDashes)}`
}

const DISPLAY_COUNT = 4

export const trainScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, _nav) {
    const station = nearestStation(snapshot.origin)
    const now = new Date()

    // 方面が2つある駅（大保など）: 2カラム表示
    if (station.directions.length >= 2) {
      const dirUp = station.directions[0]
      const dirDown = station.directions[1]
      const upDeps = getNextDepartures(dirUp, now, DISPLAY_COUNT)
      const downDeps = getNextDepartures(dirDown, now, DISPLAY_COUNT)
      const rowCount = Math.max(upDeps.length, downDeps.length)

      const separator = buildSeparator(downDeps)
      const colHeader = twoColLine(dirUp.label, dirDown.label)

      const dataLines = Array.from({ length: rowCount }, (_, i) => {
        const leftText = i < upDeps.length ? formatLeft(upDeps[i]) : ''
        const rightText = i < downDeps.length ? formatRight(downDeps[i]) : ''
        if (!leftText && !rightText) return line('')
        if (!leftText) return line(`${padLeft('')}│ ${rightText}`)
        if (!rightText) return line(padLeft(leftText))
        return line(twoColLine(leftText, rightText))
      })

      return {
        lines: [
          statusBarLine(now),
          line(`${station.name}駅`),
          line(colHeader),
          line(separator, 'meta'),
          ...dataLines,
          line(''),
          line(station.legend, 'meta'),
        ],
      }
    }

    // 方面が1つの駅: 従来の縦リスト表示
    const direction = station.directions[0]
    const departures = getNextDepartures(direction, now, 5)

    if (departures.length === 0) {
      return {
        lines: [
          statusBarLine(now),
          line(`${station.name} → ${direction.label}`),
          line(''),
          line('本日の運行は終了しました'),
        ],
      }
    }

    return {
      lines: [
        statusBarLine(now),
        line(`${station.name} → ${direction.label}`),
        line('', 'separator'),
        ...departures.map((d) => line(formatDeparture(d))),
        line(''),
        line(station.legend, 'meta'),
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
      return nav
    }
    // 2カラム表示では up/down は自身に留まる（スクロール不要）
    return nav
  },
}
