import UPNG from 'upng-js'
import type { ModalImage } from './buildModalImage'

/**
 * モーダル画素グリッド（raw 4bit グレースケール）を 16色 4bit インデックス PNG の
 * バイト列に変換する純粋関数。
 *
 * 背景: SDK の updateImageRawData.imageData は「生画素」ではなく「PNG のバイト列」を
 * 渡すもの（even_hub_sdk の .d.ts。実機で動く even-toolkit も UPNG で同形式を送る）。
 * buildModalImage が返す raw 画素をそのまま渡すと host が PNG として decode できず
 * 何も描画されない（= モーダル不可視）。ここで PNG 化して実機形式に揃える。
 *
 * パラメータは even-toolkit/glasses/png-utils.ts と同一（16色・grey = idx*17）。
 * DOM 不要・決定的なのでユニットテスト可能。
 */
export function encodeModalPng(image: ModalImage): number[] {
  const { width, height, data } = image
  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i++) {
    const grey = (data[i] ?? 0) * 17 // 0..15 → 0..255
    const si = i * 4
    rgba[si] = grey
    rgba[si + 1] = grey
    rgba[si + 2] = grey
    rgba[si + 3] = 255
  }
  const png = UPNG.encode([rgba.buffer], width, height, 16)
  return Array.from(new Uint8Array(png))
}
