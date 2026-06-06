import type {
  DepartureEntry,
  DirectionSchedule,
  Timetable,
} from './oho-timetable'

export interface Departure {
  /** "HH:MM" */
  time: string
  /** 現在時刻からの残り分数 */
  minutesLeft: number
  /** ★ 筑紫より急行 */
  express?: true
  /** 行き先短縮名 */
  dest?: string
}

// 土日のみ判定。祝日は未対応（祝日カレンダー導入時に拡張）
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function toDeparture(
  h: number,
  entry: DepartureEntry,
  nowTotal: number,
  nextDay?: true,
): Departure {
  const total = h * 60 + entry.m
  const minutesLeft = nextDay ? 24 * 60 - nowTotal + total : total - nowTotal
  const hh = String(h).padStart(2, '0')
  const mm = String(entry.m).padStart(2, '0')
  return {
    time: nextDay ? `翌${hh}:${mm}` : `${hh}:${mm}`,
    minutesLeft,
    ...(entry.express && { express: true }),
    ...(entry.dest && { dest: entry.dest }),
  }
}

/** 指定時刻以降の次の発車を最大 count 件返す */
export function getNextDepartures(
  direction: DirectionSchedule,
  now: Date,
  count: number,
): Departure[] {
  const table: Timetable = isWeekend(now)
    ? direction.weekend
    : direction.weekday
  const nowH = now.getHours()
  const nowM = now.getMinutes()
  const nowTotal = nowH * 60 + nowM

  const result: Departure[] = []

  for (let h = nowH; h <= 23 && result.length < count; h++) {
    const entries = table[h]
    if (!entries) continue
    for (const entry of entries) {
      if (result.length >= count) break
      if (h * 60 + entry.m < nowTotal) continue
      result.push(toDeparture(h, entry, nowTotal))
    }
  }

  if (result.length < count) {
    const nextDay = new Date(now)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayTable: Timetable = isWeekend(nextDay)
      ? direction.weekend
      : direction.weekday
    for (let h = 5; h <= 23 && result.length < count; h++) {
      const entries = nextDayTable[h]
      if (!entries) continue
      for (const entry of entries) {
        if (result.length >= count) break
        result.push(toDeparture(h, entry, nowTotal, true))
      }
    }
  }

  return result
}

/** 発車情報を G2 表示用の1行文字列にフォーマット */
export function formatDeparture(dep: Departure): string {
  const wait = dep.minutesLeft === 0 ? 'まもなく' : `${dep.minutesLeft}分後`
  if (dep.express) return `${dep.time}★ ${wait}`
  if (dep.dest) return `${dep.time} ${dep.dest} ${wait}`
  return `${dep.time}  ${wait}`
}
