import {
  AppShell,
  NavHeader,
  ScreenHeader,
  SectionHeader,
  SettingsGroup,
  Toggle,
} from 'even-toolkit/web'
import type { State } from '../glass/reducer'
import { AskBox } from './AskBox'
import { canPersist } from './editor'
import { PresetEditor } from './PresetEditor'
import { PRESET_MAX, type Preset } from './presets'
import type { Settings } from './settings'

interface CompanionProps {
  presets: Preset[]
  /** 編集結果を App へ返す（App が setPresets + storage.savePresets で write-through）。 */
  onPresetsChange: (next: Preset[]) => void
  /** 会話状態（その場送信の送信中/回答/エラーを AskBox がミラー表示する）。 */
  state: State
  /** その場入力テキストを Hermes へ送る（App が runAsk で Phase 1 askBridge 経由）。 */
  onAsk: (text: string) => void
  /** コンパニオン設定（音声で回答など）。 */
  settings: Settings
  /** 設定変更を App へ返す（App が setSettings + storage.saveSettings で write-through）。 */
  onSettingsChange: (next: Settings) => void
}

/**
 * スマホ WebView のメイン画面。その場で質問を送る AskBox と、グラスの Ask メニューに出る
 * プリセット質問の編集を並べる。実体はグラス表示で、この画面は装着前の設定/送信用。
 */
export function Companion({
  presets,
  onPresetsChange,
  state,
  onAsk,
  settings,
  onSettingsChange,
}: CompanionProps) {
  const pending = !canPersist(presets)
  return (
    <AppShell header={<NavHeader title="G2 Hermes" />}>
      <div className="space-y-4 px-3 pt-4 pb-8">
        <ScreenHeader
          title="カスタム質問"
          subtitle="その場で質問を送るか、グラスの Ask メニューに出る質問を編集します。"
        />
        <SectionHeader title="設定" />
        <SettingsGroup label="回答">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-[15px] text-text">音声で回答</p>
              <p className="text-[13px] text-text-dim">
                回答をスマホのスピーカーで読み上げます（既定 OFF）。
              </p>
            </div>
            <Toggle
              checked={settings.voiceAnswer}
              onChange={(voiceAnswer) =>
                onSettingsChange({ ...settings, voiceAnswer })
              }
            />
          </div>
        </SettingsGroup>
        <SectionHeader title="その場で送る" />
        <AskBox state={state} onAsk={onAsk} />
        <SectionHeader
          title={`プリセット（${presets.length} / ${PRESET_MAX}）`}
        />
        {pending && (
          <p className="text-[13px] text-text-dim">
            未入力の項目があるため、保存は保留中です（入力すると自動保存されます）。
          </p>
        )}
        <PresetEditor presets={presets} onChange={onPresetsChange} />
      </div>
    </AppShell>
  )
}
