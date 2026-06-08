import { AppGlasses } from './glass/AppGlasses'

// G2 Hermes — スマホ WebView クライアント（Phase 1: テキストのみ）。
// 実体はグラス表示で、AppGlasses が even-toolkit 経由で描画・入力を担う。
// スマホ画面は装着前の確認用ステータスのみ（Phase 1 の操作はグラス側）。
export function App() {
  return (
    <main>
      <h1>G2 Hermes Bridge</h1>
      <p>
        グラスを装着し、Ask で質問を選んでください（↕で選択・タップで送信）。
      </p>
      <AppGlasses />
    </main>
  )
}
