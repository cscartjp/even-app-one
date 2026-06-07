/**
 * 花畑駅（西鉄天神大牟田線）時刻表データ
 * 2026-03-14 ダイヤ改正準拠（ユーザー提供の公式時刻表）
 *
 * 福岡(天神)方面（上り）のみ。大牟田方面は利用しないため対象外。
 * 甘木線直通（甘木・本郷・北野行き）は利用しないため収録しない（ユーザー方針）。
 * 種別: ◆特急 / ★急行 / 無印=普通。
 * 普3（普通・筑紫より急行）は急行扱いとし、データ上は p3 ヘルパーで区別を残す。
 * 行き先は終点の西鉄福岡(天神)を既定とし、途中止まり（二日市・久留米）のみ dest を付ける。
 *
 * TODO: 土曜・日祝ダイヤ受領後に weekend / saturday を実データへ差し替える
 * （現在 weekend は平日ダイヤの仮置きで、土日祝の表示は不正確）。
 */

import type {
  DepartureEntry,
  DirectionSchedule,
  Timetable,
} from './oho-timetable'

/** 普通 */
const d = (m: number): DepartureEntry => ({ m })
/** ★急行 */
const e = (m: number): DepartureEntry => ({ m, express: true })
/** ★普3（普通・筑紫より急行）。表示は急行と同じ */
const p3 = e
/** ◆特急 */
const ltd = (m: number): DepartureEntry => ({ m, ltdExpress: true })
/** 普通・途中止まり（行き先短縮名付き） */
const t = (m: number, dest: string): DepartureEntry => ({ m, dest })

// ─── 福岡(天神)方面（上り・平日） ───
// 甘木線直通は除外済み

const upWeekday: Timetable = {
  5: [d(25), d(50), ltd(54)],
  6: [e(8), e(15), d(26), e(34), e(45), ltd(52), d(55), e(57)],
  7: [e(5), d(11), e(17), d(22), e(29), e(40), e(53), d(55)],
  8: [e(7), e(18), d(20), e(32), d(46), ltd(50)],
  9: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  10: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  11: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  12: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  13: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  14: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  15: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  16: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  17: [e(5), d(16), ltd(20), e(35), d(46), ltd(51)],
  18: [e(5), p3(11), d(16), ltd(21), e(35), p3(41), d(46), ltd(50)],
  19: [e(5), p3(11), d(16), ltd(20), e(35), p3(41), d(46), ltd(53)],
  20: [e(4), p3(11), d(16), ltd(21), e(35), d(46), ltd(50)],
  21: [e(5), d(16), ltd(20), e(35), d(46), ltd(50)],
  22: [e(5), t(16, '二日市'), e(21), e(35), d(44), e(57)],
  23: [t(1, '二日市'), t(23, '二日市'), t(44, '久留米')],
}

// ─── エクスポート ───

export const hanabatakeUp: DirectionSchedule = {
  label: '福岡(天神)方面',
  weekday: upWeekday,
  // TODO: 土日祝ダイヤ受領後に差し替え（暫定で平日を仮置き）
  weekend: upWeekday,
}

export const hanabatakeDirections: readonly DirectionSchedule[] = [hanabatakeUp]
