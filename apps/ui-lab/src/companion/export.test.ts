import { describe, expect, test } from 'bun:test'
import { buildContainers } from '../glass/buildContainers'
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
})
