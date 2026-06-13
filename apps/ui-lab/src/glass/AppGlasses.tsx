import type { DesignParams } from '../params/types'
import { useUiLabGlasses } from './useUiLabGlasses'

export interface AppGlassesProps {
  params: DesignParams
  onParamsChange: (params: DesignParams) => void
}

export function AppGlasses(props: AppGlassesProps) {
  useUiLabGlasses(props)
  return null
}
