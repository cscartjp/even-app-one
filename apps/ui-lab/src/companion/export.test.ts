import { describe, expect, test } from 'bun:test'
import {
  buildContainers,
  MODAL_IMAGE_CONTAINER_ID,
  MODAL_IMAGE_CONTAINER_NAME,
} from '../glass/buildContainers'
import { DEFAULT_DESIGN_PARAMS } from '../params/types'
import { containerSnippet, designParamsJson, exportPayload } from './export'

describe('ExportPanel helpers', () => {
  test('JSON output matches current params', () => {
    const params = { ...DEFAULT_DESIGN_PARAMS, skeleton: 'split' as const }
    expect(JSON.parse(designParamsJson(params))).toEqual(params)
  })

  test('TS snippet contains params and generated containers from the same input', () => {
    const params = {
      ...DEFAULT_DESIGN_PARAMS,
      borderWidth: 4,
      selectionStyle: 'filled' as const,
    }
    const snippet = containerSnippet(params)
    expect(snippet).toContain('"borderWidth": 4')
    expect(snippet).toContain('"selectionStyle": "filled"')
    const firstContainer = buildContainers(params)[0]
    expect(snippet).toContain(`"containerID": ${firstContainer.containerID}`)
    expect(snippet).toContain(
      `"containerName": "${firstContainer.containerName}"`,
    )
  })

  test('export payload includes serialized params and snippet', () => {
    const payload = exportPayload(DEFAULT_DESIGN_PARAMS)
    expect(JSON.parse(payload.serialized)).toEqual(DEFAULT_DESIGN_PARAMS)
    expect(payload.snippet).toContain('buildContainers')
  })

  test('border modal snippet stays text-only (no image symbols)', () => {
    const snippet = containerSnippet({
      ...DEFAULT_DESIGN_PARAMS,
      modal: true,
      modalStyle: 'border',
    })
    expect(snippet).not.toContain('buildModalImage')
    expect(snippet).not.toContain('updateImageRawData')
  })

  test('modal OFF snippet stays text-only (no image symbols)', () => {
    const snippet = containerSnippet({
      ...DEFAULT_DESIGN_PARAMS,
      modal: false,
      modalStyle: 'image',
    })
    expect(snippet).not.toContain('buildModalImage')
    expect(snippet).not.toContain('updateImageRawData')
  })

  test('image modal snippet includes image container + data + send pattern', () => {
    const snippet = containerSnippet({
      ...DEFAULT_DESIGN_PARAMS,
      modal: true,
      modalStyle: 'image',
    })
    // 画像コンテナ宣言・PNG エンコード・rebuild 後の直列送信パターンが揃う
    expect(snippet).toContain('buildModalImageContainer')
    expect(snippet).toContain('buildModalImage')
    expect(snippet).toContain('updateImageRawData')
    expect(snippet).toContain('ImageRawDataUpdate')
    // imageData は PNG バイト列を渡す（生画素直送ではない＝今回のバグ修正の核心）
    expect(snippet).toContain('encodeModalPng')
    expect(snippet).toContain('imageData: pngBytes')
    expect(snippet).not.toContain('imageData: image.data')
    // コピペで compile できるよう、使う SDK 型は全て import 済み（未定義参照が無い）
    expect(snippet).toContain('TextContainerProperty')
    expect(snippet).toContain('RebuildPageContainer')
    expect(snippet).toContain('new RebuildPageContainer({')
    // strict / noImplicitAny でも通るよう bridge は型注釈付き（無型の (bridge, は無い）
    expect(snippet).toContain('bridge: ModalImageBridge')
    expect(snippet).not.toContain('(bridge,')
    // 実装と同じ ID/名前（移植先が実ドライバと一致する）
    expect(snippet).toContain(`"containerID": ${MODAL_IMAGE_CONTAINER_ID}`)
    expect(snippet).toContain(
      `"containerName": "${MODAL_IMAGE_CONTAINER_NAME}"`,
    )
    // 生成済み PNG バイト列を埋め込む（number[]）
    expect(snippet).toContain('modalImagePngBytes: number[]')
  })
})
