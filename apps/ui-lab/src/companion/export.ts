import { buildContainers } from '../glass/buildContainers'
import type { DesignParams } from '../params/types'
import { normalizeDesignParams, serializeDesignParams } from '../params/types'

export function designParamsJson(params: DesignParams): string {
  return JSON.stringify(normalizeDesignParams(params), null, 2)
}

export function containerSnippet(params: DesignParams): string {
  const normalized = normalizeDesignParams(params)
  const containers = buildContainers(normalized).map(
    ({ textColor, backgroundColor, ...sdkSupported }) => ({
      ...sdkSupported,
      textColor,
      backgroundColor,
    }),
  )
  return `import type { DesignParams } from './params/types'
import { buildContainers } from './glass/buildContainers'

export const designParams: DesignParams = ${designParamsJson(normalized)}

export const containers = ${JSON.stringify(containers, null, 2)}

export function rebuildFromParams(params: DesignParams = designParams) {
  return buildContainers(params)
}`
}

export function exportPayload(params: DesignParams) {
  const normalized = normalizeDesignParams(params)
  return {
    params: normalized,
    serialized: serializeDesignParams(normalized),
    snippet: containerSnippet(normalized),
  }
}
