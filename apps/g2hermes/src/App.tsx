import { useEffect, useReducer, useState } from 'react'
import { DEFAULT_PRESETS, type Preset } from './companion/presets'
import { loadPresets } from './companion/storage'
import { AppGlasses } from './glass/AppGlasses'
import { initialState, reduce } from './glass/reducer'

// G2 Hermes — スマホ WebView クライアント。
// 会話状態（reducer）と presets は App が正本として保持し、AppGlasses（グラス表示）に
// props で配る（外部ストア不採用・素の React lift-up。Task 2.4）。Companion 編集 UI（2.5）も
// 同じ presets state を共有する。実体はグラス表示で、スマホ画面は装着前の確認用ステータス。
export function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS)

  // 起動時に保存済み presets を読み込む（未保存/不正は loadPresets が DEFAULT_PRESETS を返す）。
  useEffect(() => {
    let alive = true
    void loadPresets().then((p) => {
      if (alive) setPresets(p)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <main>
      <h1>G2 Hermes Bridge</h1>
      <p>
        グラスを装着し、Ask で質問を選んでください（↕で選択・タップで送信）。
      </p>
      <AppGlasses state={state} dispatch={dispatch} presets={presets} />
    </main>
  )
}
