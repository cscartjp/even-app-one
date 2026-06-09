import { Button, Card, Input, ListItem, Textarea } from 'even-toolkit/web'
import { addPreset, movePreset, removePreset, updatePreset } from './editor'
import {
  LABEL_MAX,
  PRESET_MAX,
  PRESET_MIN,
  type Preset,
  TEXT_MAX,
  validatePreset,
} from './presets'

interface PresetEditorProps {
  presets: Preset[]
  /** 編集結果を App へ返す（App が setPresets + write-through 保存）。 */
  onChange: (next: Preset[]) => void
}

/** 新規プリセットの安定 id を採番する（WebView は crypto.randomUUID を持つ）。 */
function newId(): string {
  return `preset-${crypto.randomUUID()}`
}

/**
 * 保存プリセットの CRUD + 並べ替え UI。
 * 表示・操作はここ、状態の正本と保存は App。編集ハンドラ本体は editor.ts の純粋関数。
 */
export function PresetEditor({ presets, onChange }: PresetEditorProps) {
  const canAdd = presets.length < PRESET_MAX
  const canRemove = presets.length > PRESET_MIN

  return (
    <div className="space-y-3">
      {presets.map((p, i) => {
        const valid = validatePreset(p)
        return (
          <Card key={p.id} className="space-y-3 p-3">
            <ListItem
              title={p.label.trim() || '（ラベル未入力）'}
              subtitle={`${i + 1} / ${presets.length}`}
              onDelete={
                canRemove
                  ? () => onChange(removePreset(presets, p.id))
                  : undefined
              }
              trailing={
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={i === 0}
                    aria-label="上へ移動"
                    onClick={() => onChange(movePreset(presets, i, 'up'))}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={i === presets.length - 1}
                    aria-label="下へ移動"
                    onClick={() => onChange(movePreset(presets, i, 'down'))}
                  >
                    ↓
                  </Button>
                </div>
              }
            />
            <Input
              value={p.label}
              maxLength={LABEL_MAX}
              placeholder="ラベル（グラス表示・20字以内）"
              aria-invalid={p.label.trim().length === 0}
              onChange={(e) =>
                onChange(updatePreset(presets, p.id, { label: e.target.value }))
              }
            />
            <Textarea
              value={p.text}
              rows={2}
              maxLength={TEXT_MAX}
              placeholder="送信プロンプト（Hermes へ送る本文）"
              aria-invalid={p.text.trim().length === 0}
              onChange={(e) =>
                onChange(updatePreset(presets, p.id, { text: e.target.value }))
              }
            />
            {!valid && (
              <p className="text-[13px] text-negative">
                ラベルとプロンプトを入力してください（この項目は未保存）。
              </p>
            )}
          </Card>
        )
      })}

      <Button
        variant="default"
        size="sm"
        disabled={!canAdd}
        onClick={() => onChange(addPreset(presets, newId()))}
      >
        + 質問を追加
      </Button>
    </div>
  )
}
