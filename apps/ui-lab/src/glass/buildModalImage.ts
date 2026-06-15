import type { DesignParams } from '../params/types'

/**
 * 画像方式モーダルを 1 枚の 4bit グレースケール画像として焼き込む純粋関数。
 *
 * 背景: これは「不透明モーダルは作れない」ことの検証デモ。G2 は透過加算ディスプレイ
 * （黒=消灯=透過）で、画像のベタ塗りを前面に置いても背後を遮蔽できず不透明化は成立しない
 * （実機検証 2026-06-15）。z 順で画像が前面なのは事実だが、加算光なので背後は透ける。
 * 本物の不透明モーダルは OS の shutDownPageContainer(1)（終了確認）のみ。
 * 詳細は docs/spec/ui-lab-sandbox.md「画像モーダル＝negative result」を参照。
 *
 * 出力は raw 4bit グレースケール: 1 ピクセル = 1 値（0..15）、length = width*height。
 * 副作用なし・決定的（同じ params → 同じ出力）なので DOM 無しでユニットテスト可能。
 */

// G2 画像コンテナ上限は SDK .d.ts で 幅20–288 / 高さ20–144。ただし docs/guides の
// 記載（幅20–200 / 高さ20–100）と交差する安全側に固定して両制約を満たす。
export const MODAL_IMAGE_MAX_W = 200
export const MODAL_IMAGE_MAX_H = 100
export const MODAL_IMAGE_W = 200
export const MODAL_IMAGE_H = 100

const BG_LEVEL = 6 // 中間グレーの背景塗り（加算光なので実機では背後が透ける）
const MOTIF_LEVEL = 15 // ドット絵モチーフ（info マーカー）は最も明るく
const MIN_RING = 2
const MAX_RING = 6

export interface ModalImage {
  width: number
  height: number
  /** 1 ピクセル = 1 値（0..15）の 4bit グレースケール。length = width*height */
  data: number[]
}

// 7x9 の info マーカー（"!"）。1=点灯。決定的なドット絵モチーフ。
const MOTIF: readonly string[] = [
  '0011100',
  '0011100',
  '0011100',
  '0011100',
  '0011100',
  '0000000',
  '0011100',
  '0011100',
  '0000000',
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** ドット絵モチーフを 3 倍拡大して左側に配置する（決定的）。 */
function paintMotif(data: number[], w: number, h: number) {
  const scale = 3
  const startX = 18
  const startY = Math.floor((h - MOTIF.length * scale) / 2)
  MOTIF.forEach((row, my) => {
    for (let mx = 0; mx < row.length; mx++) {
      if (row[mx] !== '1') continue
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = startX + mx * scale + sx
          const py = startY + my * scale + sy
          if (px >= 0 && px < w && py >= 0 && py < h) {
            data[py * w + px] = MOTIF_LEVEL
          }
        }
      }
    }
  })
}

export function buildModalImage(params: DesignParams): ModalImage {
  const w = MODAL_IMAGE_W
  const h = MODAL_IMAGE_H
  const data = new Array<number>(w * h).fill(BG_LEVEL)

  // 枠: borderColor で明るさ、padding で太さを決定的に決める（params 反映）。
  const ring = clamp(
    MIN_RING + Math.round(params.padding / 8),
    MIN_RING,
    MAX_RING,
  )
  const ringLevel = clamp(Math.max(params.borderColor, 12), 0, 15)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const onRing = x < ring || x >= w - ring || y < ring || y >= h - ring
      if (onRing) data[y * w + x] = ringLevel
    }
  }

  // ラベル帯: モーダルである事を示す明るい下線バンド（テキスト描画は不可なので帯で表現）。
  const bandY1 = h - ring - 16
  const bandY2 = h - ring - 12
  for (let y = bandY1; y < bandY2; y++) {
    for (let x = ring + 8; x < w - ring - 8; x++) {
      if (y >= 0 && y < h) data[y * w + x] = MOTIF_LEVEL
    }
  }

  paintMotif(data, w, h)

  return { width: w, height: h, data }
}
