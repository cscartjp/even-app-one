/**
 * HTTP Range ヘッダの解釈結果。
 * - `full`: Range 無し → 200 で全体配信。
 * - `range`: 充足可能な単一範囲 → 206 + Content-Range。`start`/`end` は inclusive。
 * - `unsatisfiable`: 不正・範囲外 → 416。
 */
export type RangeResult =
  | { type: 'full' }
  | { type: 'range'; start: number; end: number }
  | { type: 'unsatisfiable' }

/**
 * `Range: bytes=...` を解釈する純関数（単一範囲のみ対応）。
 * `bytes=start-end` / `bytes=start-`（末尾まで）/ `bytes=-suffix`（末尾 suffix バイト）を受ける。
 * total=0、複数範囲、bytes 以外の単位、範囲外・逆転は unsatisfiable（416）にする。
 */
export function parseRange(
  header: string | undefined,
  total: number,
): RangeResult {
  if (!header) return { type: 'full' }

  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return { type: 'unsatisfiable' }
  const startStr = m[1]
  const endStr = m[2]
  // 両端とも空（`bytes=-`）は不正。
  if (startStr === '' && endStr === '') return { type: 'unsatisfiable' }
  if (total <= 0) return { type: 'unsatisfiable' }

  let start: number
  let end: number
  if (startStr === '') {
    // suffix 指定: 末尾 suffix バイト。suffix=0 は不正。
    const suffix = Number(endStr)
    if (suffix <= 0) return { type: 'unsatisfiable' }
    start = Math.max(0, total - suffix)
    end = total - 1
  } else {
    start = Number(startStr)
    end = endStr === '' ? total - 1 : Number(endStr)
  }

  if (start > end || start < 0 || start >= total) {
    return { type: 'unsatisfiable' }
  }
  // end が総長を超える場合は末尾までにクランプ（RFC 7233）。
  if (end >= total) end = total - 1
  return { type: 'range', start, end }
}
