import {
  AppShell,
  NavHeader,
  ScreenHeader,
  SectionHeader,
} from 'even-toolkit/web'
import { canPersist } from './editor'
import { PresetEditor } from './PresetEditor'
import { PRESET_MAX, type Preset } from './presets'

interface CompanionProps {
  presets: Preset[]
  /** 編集結果を App へ返す（App が setPresets + storage.savePresets で write-through）。 */
  onPresetsChange: (next: Preset[]) => void
}

/**
 * スマホ WebView のメイン画面。グラスの Ask メニューに出るプリセット質問を編集する。
 * 実体はグラス表示で、この画面は装着前の設定用（実機の保存永続はユーザー確認）。
 */
export function Companion({ presets, onPresetsChange }: CompanionProps) {
  const pending = !canPersist(presets)
  return (
    <AppShell header={<NavHeader title="G2 Hermes" />}>
      <div className="space-y-4 px-3 pt-4 pb-8">
        <ScreenHeader
          title="カスタム質問"
          subtitle="グラスの Ask メニューに出る質問を編集します。↕で並べ替え・スワイプで削除。"
        />
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
