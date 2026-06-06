import type { DirectionSchedule, Timetable } from './oho-timetable'

export interface Departure {
  /** "HH:MM" */
  time: string
  /** 現在時刻からの残り分数 */
  minutesLeft: number
}

/** 土日祝なら true */
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
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

  // 現在時刻の時台から 23 時台まで走査
  for (let h = nowH; h <= 23 && result.length < count; h++) {
    const mins = table[h]
    if (!mins) continue
    for (const m of mins) {
      if (result.length >= count) break
      const total = h * 60 + m
      if (total < nowTotal) continue
      result.push({
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        minutesLeft: total - nowTotal,
      })
    }
  }

  // 足りなければ翌日の始発から補填
  if (result.length < count) {
    const nextDayTable: Timetable = isWeekend(now)
      ? direction.weekend
      : direction.weekday
    for (let h = 5; h <= 23 && result.length < count; h++) {
      const mins = nextDayTable[h]
      if (!mins) continue
      for (const m of mins) {
        if (result.length >= count) break
        const total = 24 * 60 - nowTotal + h * 60 + m
        result.push({
          time: `翌${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          minutesLeft: total,
        })
      }
    }
  }

  return result
}

/** 発車情報を G2 表示用の1行文字列にフォーマット */
export function formatDeparture(dep: Departure): string {
  if (dep.minutesLeft === 0) return `${dep.time}  まもなく`
  return `${dep.time}  ${dep.minutesLeft}分後`
}
