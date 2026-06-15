import type {
  DesignParams,
  ModalStyle,
  SelectionStyle,
  SeparatorStyle,
  Skeleton,
} from '../params/types'
import { normalizeDesignParams } from '../params/types'

export type NumericParamKey = {
  [K in keyof DesignParams]: DesignParams[K] extends number ? K : never
}[keyof DesignParams]

export type BooleanParamKey = {
  [K in keyof DesignParams]: DesignParams[K] extends boolean ? K : never
}[keyof DesignParams]

export type ChoiceParamKey =
  | 'selectionStyle'
  | 'separator'
  | 'skeleton'
  | 'modalStyle'
export type ChoiceParamValue =
  | SelectionStyle
  | SeparatorStyle
  | Skeleton
  | ModalStyle

export function updateNumericParam(
  params: DesignParams,
  key: NumericParamKey,
  value: number,
): DesignParams {
  return normalizeDesignParams({ ...params, [key]: value })
}

export function updateBooleanParam(
  params: DesignParams,
  key: BooleanParamKey,
  value: boolean,
): DesignParams {
  return normalizeDesignParams({ ...params, [key]: value })
}

export function updateChoiceParam(
  params: DesignParams,
  key: ChoiceParamKey,
  value: ChoiceParamValue,
): DesignParams {
  return normalizeDesignParams({ ...params, [key]: value })
}
