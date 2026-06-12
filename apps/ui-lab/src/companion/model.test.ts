import { describe, expect, test } from 'bun:test'
import { DEFAULT_DESIGN_PARAMS } from '../params/types'
import {
  updateBooleanParam,
  updateChoiceParam,
  updateNumericParam,
} from './model'

describe('companion control helpers', () => {
  test('numeric control changes update and clamp DesignParams', () => {
    const next = updateNumericParam(DEFAULT_DESIGN_PARAMS, 'borderWidth', 99)
    expect(next.borderWidth).toBe(5)
    expect(next.borderRadius).toBe(DEFAULT_DESIGN_PARAMS.borderRadius)
  })

  test('choice controls update segmented values', () => {
    const next = updateChoiceParam(
      DEFAULT_DESIGN_PARAMS,
      'selectionStyle',
      'filled',
    )
    expect(next.selectionStyle).toBe('filled')
  })

  test('toggle controls update boolean values', () => {
    const next = updateBooleanParam(DEFAULT_DESIGN_PARAMS, 'modal', true)
    expect(next.modal).toBe(true)
  })
})
