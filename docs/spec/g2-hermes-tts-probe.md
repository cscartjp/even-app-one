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

## 実機プローブ結果（7.5・Android）

> 実機: **Android**（Even Hub「In Development」に probe-ON パッケージをアップして確認。サイドロードは未使用）。iPhone 未所持のため **iOS 側（②③④ × `speechSynthesis`）は未検証**。
> パッケージ: `g2hermes-0.2.7-ttsprobe.ehpk`（`VITE_TTS_PROBE=1` でビルド・whitelist は実 Bridge origin）。
> 確認手段: 聴覚（回答後に鳴る「ポッ」＝ `new Audio()` data-URI ビープ 100ms/440Hz）＋ グラス verdict 行 `🔊spk=N aud=Y v=0` の**両方が一致**。

| ケース | `spk`（speechSynthesis の声）| `aud`（`new Audio()` 再生）| 判定 |
|---|---|---|---|
| ② 前面・自動（回答受領後にタップ無し）| N | **Y**（ポッ）| 方式2/3 可 |
| ④ 背面・画面オフ・自動（別画面/画面オフ中に回答が返る）| N | **Y**（鳴った）| 方式2/3 可（本命）|
| 方式1 `speechSynthesis` | N | — | Android 不可 |

- `spk=N` / `v=0`: Android System WebView は `speechSynthesis` を持たず（`hasSpeechSynthesis=false`）、speak 経路は走らない。声は出ない＝想定どおり。
- `aud=Y`: `new Audio(data-URI).play()` が前面・自動でも、**背面・画面オフでも**例外なく再生。iOS WKWebView の「背面で音が止まる既知バグ」に相当する挙動は **Android では観測されなかった**。
- ③ ジェスチャ（review 画面の「タップ:送信」起点 = `AppGlasses.send`）は、②自動が既に通るため Android では切り分け不要（user activation 制約は iOS 固有）。

## 結論（7.6・go/no-go）

- **Android = go（方式2/3）**: 回答読み上げは **サーバ生成 MP3 を `new Audio()`/`<audio>` で再生する方式2/3 が前面・背面とも有効**。G2 実利用（グラス装着・スマホはポケット＝背面）でも背面・画面オフで再生が通ることを実機で確認。**方式1（Web Speech API）は Android 非対応のため no-go**。
- **iOS = 未判定**: iPhone 未所持。方式1の go/no-go と前面/背面差は iOS 実機が必要。必要になった時点で同 probe パッケージで再取得する。
- **【2026-06-11 更新】本線は方式2（Aivis）へ確定**: Mac B に **AivisSpeech**（VOICEVOX 互換・`127.0.0.1:10101`・WAV 44100/mono/16bit・既定話者 `888753760`）を導入したため、本実装の本線を **方式2（ローカル AivisSpeech・WAV をそのまま配信）** に更新する（当初想定の方式3=OpenAI TTS から変更）。音声生成は **G2 Bridge が AivisSpeech Engine を直接叩く独立実装**（Hermes Agent 自身の TTS 設定とは分離）。本実装の product contract は **`docs/spec/g2-hermes-voice-answer.md`（Phase 8）** に固定し、タスクは `Plans.md` Phase 8 で管理する。
- **次手（本実装の配線）**: 接続先 **Mac B（Hermes Agent / Bridge / AivisSpeech ホスト）に WAV 生成基盤が既に稼働**するため、MP3 生成バックエンドは不要。これで本実装の 2 大不確実性（① Android 背面含む再生可否＝プローブで解消 / ② 音声生成基盤の有無＝Aivis で解消）が両方とも潰れた。残りは配線のみ:
  - Bridge: 回答に `audioUrl` を添える（`/audio/<id>` で **WAV** 配信）。
  - クライアント: `ANSWERED` で `new Audio(audioUrl).play()`（プローブ実証の経路そのまま・自動再生 OK）。
  - ネットワーク: 音声（WAV）を **Bridge と同一 origin から配れば whitelist は既存テキスト API と共通で済む見込み**。`new Audio()` の単純再生は **CORS も不要**（Web Audio で波形を読まない限り）。→ whitelist 追加 / CORS は最小〜不要の可能性。
- プローブ（`VITE_TTS_PROBE` gate）は本実装まで **OFF 既定で温存**（通常配布はバイト等価のまま）。
