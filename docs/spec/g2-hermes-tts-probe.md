# G2 Hermes — TTS 実機プローブ（サブ spec）

> product contract（正本）: `docs/spec/g2-hermes-bridge.md`
> precedence: `g2-hermes-bridge.md` > 各サブ spec > 本 spec > `Plans.md`
> 起票: 音声応答（回答テキストの読み上げ）構想の実装可否調査。本 spec は **本実装ではなくプローブ（feasibility probe）の契約**を固定する。

## 背景・目的

Even G2 にはスピーカーが無く、音声は**スマホのスピーカー**から出すしかない。その再生は Even Hub の **Flutter WebView（iOS=WKWebView）内**で起きる。3つの実装候補（方式1: Web Speech API / 方式2: ローカル MP3（AivisSpeech）/ 方式3: OpenAI TTS）はいずれも WebView 内再生に依存し、**同一の壁**を持つ:

- **Android System WebView は `speechSynthesis` 非対応**（方式1は実質 iPhone 専用）。
- **WKWebView はアプリ背面化・画面ロックで音声を停止する既知バグ**（Web Audio / `<audio>` / `speechSynthesis` 共通）。G2 の実利用 = グラス装着・スマホはポケット = **背面**。
- **iOS は初回 `speak()`/`Audio.play()` にユーザー操作（user activation）を要求する**版がある。回答は LLM 応答後に自動で鳴らすため、ジェスチャ制約に当たる可能性。

机上では Even 社の WebView 設定（自動再生ポリシー・背面挙動）が不明で断定できない。**本実装の前に、ユーザーの実機（iPhone）で前面/背面の鳴動可否を確定する**のが本 spec のゴール。

## スコープ

**やること（プローブ）**:
- 方式1（`speechSynthesis`）と方式2/3に共通する `new Audio()`（data-URI の短音）の**両方**を、実機で鳴らして観測する最小機構。
- 観測軸の matrix を取る:
  1. capability: `'speechSynthesis' in window` / `getVoices()`（`voiceschanged` 待ちで settle）に ja-JP 音声があるか。
  2. **前面・自動発話**（回答受領後にタップ無しで `speak()`）→ 鳴るか。
  3. **前面・ジェスチャ発話**（グラス CLICK / 送信タップ起点で `speak()`）→ 鳴るか。
  4. **背面・自動発話**（thinking 待ち中に画面ロック→回答が背面で返る）→ 鳴るか。
  5. 各ケースで `new Audio()` 経路も同時に試し、方式1と方式2/3の差を見る。
- ②③の切り分けにより「**ジェスチャ制約で鳴らない**」と「**背面suspendで鳴らない**」を弁別する。

**やらないこと（本実装ではない）**:
- MP3 生成（Bridge 側）/ `audioUrl` 配信 / network whitelist 追加 / CORS。プローブは**ネットワークを増やさない**（on-device TTS と data-URI のみ）。
- 本番の読み上げ UX（停止制御・ページ同期・話速設定の作り込み）。
- Bridge / STT / コンパニオンの変更。

## 設計契約

- **差し込み点**: `apps/g2hermes/src/glass/ask.ts` の `runAsk`、`ANSWERED` dispatch の直前（Bridge 回答が返る唯一の集約点）。グラス CLICK 起点の③は別途イベント経路に最小フックを足す。
- **フラグ gate（非破壊の核）**: プローブは `import.meta.env.VITE_TTS_PROBE`（既定 OFF）でのみ有効。**OFF のとき `ask.ts` の挙動はバイト等価**（フック完全 no-op）。通常配布はフラグ OFF、プローブ用 `.ehpk` だけ ON でビルドする。
- **可視化（背面で console が読めない問題への対処）**: プローブ verdict（例 `🔊spk=Y aud=N v=3`）を**グラス表示の回答に1行だけ追記**し、ユーザーがグラス越しに結果を視認できるようにする。最終判定は**聴覚**（鳴ったか）＋このグラス表示で取る。前面の詳細 console は Safari Web Inspector（Mac→iPhone WebView）で確認可能。
- **isolation**: 副作用は `apps/g2hermes/src/audio/ttsProbe.ts` に隔離。ピュアな capability 整形・verdict 整形・gate 判定はユニットテスト対象、実発話（`speak`/`play`）は device-io として skip。
- **セキュリティ**: 新たな秘密情報・ネットワーク egress なし。読み上げ対象は既にグラスへ送る回答テキストで、同一端末でのローカル発話は新たな境界を作らない。`.ehpk` ビルドは既存 ENV 規約（実 BASE 値・version を bundle で `rg` 検証、build→pack 順、`evenhub` 直叩き）を踏襲。

## 完了の定義（プローブとして）

実機 matrix（②③④ × `speechSynthesis`/`Audio`）の鳴動可否が記録され、方式1の go/no-go と「前面限定で割り切るか／Even 社へネイティブ再生 API を要望するか」の判断材料が揃うこと。
