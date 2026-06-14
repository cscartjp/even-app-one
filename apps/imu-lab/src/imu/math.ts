// IMU 生値から姿勢を導く純粋関数群。
// 全関数 SDK 非依存・副作用なし（bun test 対象）。
// スパイクの目的は「x/y/z の素性を実機で見る」ことなので、まず x/y/z を
// そのまま出しつつ、軸の割り当てが未知でも使える指標として
// 「キャリブレーション基準ベクトルとの角度差 θ」を中心に据える。

/** IMU の 1 サンプル（重力成分を含む 3 軸ベクトル）。 */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/** 計測ログの 1 行。受信時刻（ms, performance.now 基準）付き。 */
export interface ImuSample extends Vec3 {
  /** 受信時刻（ms）。レート算出に使う。 */
  t: number
}

/** ベクトルの大きさ（ノルム）。静止時はほぼ重力一定値になるはず（単位の手がかり）。 */
export function norm(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z)
}

/** 単位ベクトル化。ゼロベクトルは null（角度計算不能）。 */
export function normalize(v: Vec3): Vec3 | null {
  const n = norm(v)
  if (n === 0 || !Number.isFinite(n)) return null
  return { x: v.x / n, y: v.y / n, z: v.z / n }
}

/** 2 ベクトルのなす角（度）。正規化不能なら null。dot は [-1,1] にクランプ。 */
export function angleBetweenDeg(a: Vec3, b: Vec3): number | null {
  const na = normalize(a)
  const nb = normalize(b)
  if (!na || !nb) return null
  const dot = na.x * nb.x + na.y * nb.y + na.z * nb.z
  const clamped = Math.min(1, Math.max(-1, dot))
  return (Math.acos(clamped) * 180) / Math.PI
}

/**
 * 複数サンプルの単純移動平均。歩行時の 1 歩ごとの加速度ノイズを均し、
 * 重力成分（＝頭の向き）を取り出す目的。空配列はゼロベクトル。
 */
export function movingAverageVec(samples: Vec3[]): Vec3 {
  if (samples.length === 0) return { x: 0, y: 0, z: 0 }
  let sx = 0
  let sy = 0
  let sz = 0
  for (const s of samples) {
    sx += s.x
    sy += s.y
    sz += s.z
  }
  const n = samples.length
  return { x: sx / n, y: sy / n, z: sz / n }
}

/**
 * 受信時刻列から実効レート（Hz）を推定する。隣接間隔の平均から算出。
 * サンプルが 2 未満、または間隔が取れない場合は 0。
 */
export function rateHz(timestampsMs: number[]): number {
  if (timestampsMs.length < 2) return 0
  const first = timestampsMs[0]
  const last = timestampsMs[timestampsMs.length - 1]
  const span = last - first
  if (span <= 0) return 0
  // n 個の点なら間隔は n-1 個。
  return ((timestampsMs.length - 1) / span) * 1000
}

/** 角度を丸めた整数（表示用）。-0 は 0 に正規化する。 */
export function roundDeg(deg: number): number {
  return Math.round(deg) + 0
}

/** CSV ヘッダ（ログ持ち帰り用）。 */
export const CSV_HEADER = 't_ms,x,y,z,norm'

/** サンプル 1 件を CSV 行に整形（小数 4 桁）。 */
export function toCsvRow(s: ImuSample): string {
  const f = (v: number) => v.toFixed(4)
  return `${Math.round(s.t)},${f(s.x)},${f(s.y)},${f(s.z)},${f(norm(s))}`
}

/** サンプル列を CSV 文字列に（ヘッダ込み）。 */
export function formatCsv(samples: ImuSample[]): string {
  return [CSV_HEADER, ...samples.map(toCsvRow)].join('\n')
}
