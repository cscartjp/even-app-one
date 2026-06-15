import {
  AppShell,
  NavHeader,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  SettingsGroup,
  Slider,
  Toggle,
} from 'even-toolkit/web'
import {
  BORDER_COLOR_RANGE,
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  type DesignParams,
  DISPLAY_RANGE,
  LINE_GAP_RANGE,
  MODAL_STYLES,
  PADDING_RANGE,
  SELECTION_STYLES,
  SEPARATORS,
  SKELETONS,
} from '../params/types'
import { appVersion } from '../version'
import { ExportPanel } from './ExportPanel'
import {
  type BooleanParamKey,
  type ChoiceParamKey,
  type ChoiceParamValue,
  type NumericParamKey,
  updateBooleanParam,
  updateChoiceParam,
  updateNumericParam,
} from './model'

interface CompanionProps {
  params: DesignParams
  onParamsChange: (params: DesignParams) => void
}

interface SliderSpec {
  key: NumericParamKey
  label: string
  min: number
  max: number
}

const SLIDERS: SliderSpec[] = [
  { key: 'borderWidth', label: 'Border width', ...BORDER_WIDTH_RANGE },
  { key: 'borderRadius', label: 'Border radius', ...BORDER_RADIUS_RANGE },
  { key: 'borderColor', label: 'Border color', ...BORDER_COLOR_RANGE },
  { key: 'padding', label: 'Padding', ...PADDING_RANGE },
  { key: 'cardWidth', label: 'Card width', ...DISPLAY_RANGE.width },
  { key: 'cardHeight', label: 'Card height', ...DISPLAY_RANGE.height },
  { key: 'lineGap', label: 'Line gap', ...LINE_GAP_RANGE },
]

const choiceOptions = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value }))

export function Companion({ params, onParamsChange }: CompanionProps) {
  const setNumeric = (key: NumericParamKey, value: number) => {
    onParamsChange(updateNumericParam(params, key, value))
  }
  const setBoolean = (key: BooleanParamKey, value: boolean) => {
    onParamsChange(updateBooleanParam(params, key, value))
  }
  const setChoice = (key: ChoiceParamKey, value: ChoiceParamValue) => {
    onParamsChange(updateChoiceParam(params, key, value))
  }

  return (
    <AppShell header={<NavHeader title="UI Lab" />}>
      <div className="space-y-4 px-3 pt-4 pb-8">
        <ScreenHeader
          title="UI Lab"
          subtitle={`G2 container sandbox v${appVersion()}`}
        />

        <SectionHeader title="Frame" />
        <SettingsGroup label="Numbers">
          <div className="space-y-4 py-2">
            {SLIDERS.map((spec) => (
              <div className="space-y-2" key={spec.key}>
                <span className="flex items-center justify-between text-[13px] text-text-dim">
                  <span>{spec.label}</span>
                  <span className="font-mono text-text">
                    {params[spec.key]}
                  </span>
                </span>
                <Slider
                  value={params[spec.key]}
                  min={spec.min}
                  max={spec.max}
                  step={1}
                  onChange={(value) => setNumeric(spec.key, value)}
                />
              </div>
            ))}
          </div>
        </SettingsGroup>

        <SectionHeader title="Layout" />
        <SettingsGroup label="Modes">
          <div className="space-y-4 py-2">
            <SegmentedControl
              size="small"
              value={params.selectionStyle}
              options={choiceOptions(SELECTION_STYLES)}
              onValueChange={(value) =>
                setChoice('selectionStyle', value as ChoiceParamValue)
              }
            />
            <SegmentedControl
              size="small"
              value={params.separator}
              options={choiceOptions(SEPARATORS)}
              onValueChange={(value) =>
                setChoice('separator', value as ChoiceParamValue)
              }
            />
            <SegmentedControl
              size="small"
              value={params.skeleton}
              options={choiceOptions(SKELETONS)}
              onValueChange={(value) =>
                setChoice('skeleton', value as ChoiceParamValue)
              }
            />
          </div>
        </SettingsGroup>

        <SectionHeader title="Toggles" />
        <SettingsGroup label="State">
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-text">Status bar</span>
              <Toggle
                checked={params.showStatusBar}
                onChange={(value) => setBoolean('showStatusBar', value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[15px] text-text">Modal</span>
              <Toggle
                checked={params.modal}
                onChange={(value) => setBoolean('modal', value)}
              />
            </div>
            <div className="space-y-2">
              <span className="text-[13px] text-text-dim">Modal style</span>
              <SegmentedControl
                size="small"
                value={params.modalStyle}
                options={choiceOptions(MODAL_STYLES)}
                onValueChange={(value) =>
                  setChoice('modalStyle', value as ChoiceParamValue)
                }
              />
              <p className="text-[12px] text-text-dim leading-snug">
                image = 「不透明モーダルは作れない」検証デモ。G2
                は透過加算ディスプレイのため画像のベタ塗りでも背後を遮蔽できず不透明化は不可。常時こまかくちらつく。本物のモーダルは
                OS の終了確認（shutDownPageContainer）のみで任意 UI 不可。border
                = 枠だけで無ちらつき だが背後が透ける（実用上の擬似モーダル）。
              </p>
            </div>
          </div>
        </SettingsGroup>

        <ExportPanel params={params} />
      </div>
    </AppShell>
  )
}
