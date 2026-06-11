import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { Companion } from './companion/Companion'
import { canPersist } from './companion/editor'
import {
  DEFAULT_PRESETS,
  type Preset,
  validatePreset,
} from './companion/presets'
import { DEFAULT_SETTINGS, type Settings } from './companion/settings'
import {
  loadPresets,
  loadSettings,
  savePresets,
  saveSettings,
} from './companion/storage'
import { AppGlasses } from './glass/AppGlasses'
import { runAsk } from './glass/ask'
import { initialState, reduce } from './glass/reducer'

// G2 Hermes — スマホ WebView クライアント。
// 会話状態（reducer）と presets は App が正本として保持し、AppGlasses（グラス表示）に
// props で配る（外部ストア不採用・素の React lift-up。Task 2.4）。Companion 編集 UI（2.5）も
// 同じ presets state を共有する。実体はグラス表示で、スマホ画面は装着前の確認用ステータス。
export function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  // ユーザーが編集を始めたか。起動時 loadPresets が遅れて解決した場合に編集を上書きしないためのフラグ。
  const dirtyRef = useRef(false)
  // settings 版の dirty ガード（トグル操作が起動ロードに潰されないようにする）。
  const settingsDirtyRef = useRef(false)
  // ask 送信時に最新 settings を参照する（古いクロージャ回避・グラスへも props で配る）。
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // 起動時に保存済み presets / settings を読み込む（未保存/不正は default を返す）。
  useEffect(() => {
    let alive = true
    void loadPresets().then((p) => {
      // 先にユーザーが編集していたら（dirty）、起動ロード結果で編集中 state を潰さない
      // （bridge 待ち 1500ms / 実機初期化が遅い環境での編集ロストを防ぐ）。
      if (alive && !dirtyRef.current) setPresets(p)
    })
    void loadSettings().then((s) => {
      if (alive && !settingsDirtyRef.current) setSettings(s)
    })
    return () => {
      alive = false
    }
  }, [])

  // 編集結果を state に反映し、保存可能（全件検証通過・件数範囲内）なら storage へ write-through。
  // 不正リスト（編集途中の空欄など）は保存せず state のキャッシュに留め、次回起動の default 落ちを防ぐ。
  const handlePresetsChange = useCallback((next: Preset[]) => {
    dirtyRef.current = true
    setPresets(next)
    if (canPersist(next)) void savePresets(next)
  }, [])

  // 設定変更を state に反映し storage へ write-through（presets と別キー）。
  const handleSettingsChange = useCallback((next: Settings) => {
    settingsDirtyRef.current = true
    setSettings(next)
    void saveSettings(next)
  }, [])

  // グラス（idle メニュー / askBridge）へは検証通過のプリセットだけ渡す。編集中の draft
  // （空ラベル / 空プロンプト等の不正要素）はスマホ editor にのみ見せ、idle 空行や空送信を防ぐ。
  const glassPresets = useMemo(() => presets.filter(validatePreset), [presets])

  // スマホ AskBox からのその場送信。共有 runAsk でグラスの ask と同一経路（Phase 1 askBridge）を流す。
  // 同じ reducer state を AskBox とグラスの両方が購読し、送信中/回答/エラーがミラー表示される。
  // 設定「音声で回答」が ON なら tts:true を渡す（最新値を ref から読む）。
  const handleAsk = useCallback((text: string) => {
    void runAsk(dispatch, text, text, { tts: settingsRef.current.voiceAnswer })
  }, [])

  // スマホ WebView は Companion（その場送信 + 編集 draft 全件）を描画。グラス表示は
  // AppGlasses（DOM 非描画）が valid な部分集合を購読する（編集が idle メニューへ即反映）。
  return (
    <>
      <Companion
        presets={presets}
        onPresetsChange={handlePresetsChange}
        state={state}
        onAsk={handleAsk}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />
      <AppGlasses
        state={state}
        dispatch={dispatch}
        presets={glassPresets}
        settings={settings}
      />
    </>
  )
}
