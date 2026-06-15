import {
  buildContainers,
  buildModalImageContainer,
} from '../glass/buildContainers'
import { buildModalImage } from '../glass/buildModalImage'
import { encodeModalPng } from '../glass/encodeModalPng'
import type { DesignParams } from '../params/types'
import { normalizeDesignParams, serializeDesignParams } from '../params/types'

export function designParamsJson(params: DesignParams): string {
  return JSON.stringify(normalizeDesignParams(params), null, 2)
}

function isImageModal(params: DesignParams): boolean {
  return params.modal && params.modalStyle === 'image'
}

/**
 * image 方式モーダルの移植用パターン。実ドライバ useUiLabGlasses.ts と同形:
 * rebuild の imageObject に画像コンテナを宣言 → rebuild 後に updateImageRawData で
 * 画素を直列送信する（rebuild 時には画素を送れない）。
 */
function imageModalSnippet(params: DesignParams): string {
  const imageContainer = buildModalImageContainer()
  const modalPngBytes = encodeModalPng(buildModalImage(params))
  return `
// ── image 方式モーダル（modalStyle: 'image'）の移植パターン ──
// 「不透明モーダルは作れない」検証デモ。G2 は透過加算ディスプレイ（黒=消灯=透過）で、
// 画像が z 順で前面でもベタ塗りは背後を遮蔽できず不透明化は成立しない（実機検証 2026-06-15）。
// 加えて画像コンテナは常時ちらつく（ファーム仕様）。詳細は docs/spec/ui-lab-sandbox.md 参照。
import { ImageContainerProperty, ImageRawDataUpdate, RebuildPageContainer, TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { buildModalImageContainer } from './glass/buildContainers'
import { buildModalImage } from './glass/buildModalImage'
import { encodeModalPng } from './glass/encodeModalPng'

export const modalImageContainer = ${JSON.stringify(imageContainer, null, 2)}

// imageData は「生画素」ではなく「PNG のバイト列」を渡す（SDK 仕様・実機形式）。
// 生画素を直送すると host が decode できず描画されないので必ず encodeModalPng で PNG 化する。
export const modalImagePngBytes: number[] = ${JSON.stringify(modalPngBytes)}

// strict / noImplicitAny でもコピペ compile できるよう、使う2メソッドだけの最小型を定義。
interface ModalImageBridge {
  rebuildPageContainer(page: RebuildPageContainer): Promise<unknown>
  updateImageRawData(data: ImageRawDataUpdate): Promise<unknown>
}

// rebuild に画像コンテナを足して再描画 → rebuild 後に PNG バイト列を直列送信する。
export async function rebuildWithModalImage(bridge: ModalImageBridge, params: DesignParams = designParams) {
  const textObject = buildContainers(params).map((c) => new TextContainerProperty(c))
  const c = buildModalImageContainer()
  await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: textObject.length + 1,
    textObject,
    imageObject: [new ImageContainerProperty(c)],
  }))
  const pngBytes = encodeModalPng(buildModalImage(params))
  await bridge.updateImageRawData(
    new ImageRawDataUpdate({
      containerID: c.containerID,
      containerName: c.containerName,
      imageData: pngBytes,
    }),
  )
}`
}

export function containerSnippet(params: DesignParams): string {
  const normalized = normalizeDesignParams(params)
  const containers = buildContainers(normalized)
  const base = `import type { DesignParams } from './params/types'
import { buildContainers } from './glass/buildContainers'

export const designParams: DesignParams = ${designParamsJson(normalized)}

export const containers = ${JSON.stringify(containers, null, 2)}

export function rebuildFromParams(params: DesignParams = designParams) {
  return buildContainers(params)
}`
  return isImageModal(normalized) ? base + imageModalSnippet(normalized) : base
}

export function exportPayload(params: DesignParams) {
  const normalized = normalizeDesignParams(params)
  return {
    params: normalized,
    serialized: serializeDesignParams(normalized),
    snippet: containerSnippet(normalized),
  }
}
