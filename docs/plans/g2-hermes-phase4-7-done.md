# G2 Hermes Plans アーカイブ — Phase 4 / Phase 7（完了）

> 本ファイルは `Plans.md` から退避した**完了済み Phase の詳細**（task ledger のスナップショット）。
> task contract の正本は `Plans.md`、product contract は `docs/spec/g2-hermes-bridge.md` + 各サブ spec。
> アーカイブ日: 2026-06-11（`/maintenance plans` による Plans.md 圧縮）。
> 関連サブ spec: Phase 4 = `docs/spec/g2-hermes-waiting-spinner.md` / Phase 7 = `docs/spec/g2-hermes-tts-probe.md`。

---

## Phase 4: 待ち時間テキストスピナー（issue #36）

> **Spec delta（2026-06-09・確定）**: product contract `docs/spec/g2-hermes-bridge.md` の上に、待ち時間フェーズ（`thinking` / `transcribing`）のグラス表示にテキストスピナーを足す設計デルタを `docs/spec/g2-hermes-waiting-spinner.md` として新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-phase3-voice.md` > `g2-hermes-waiting-spinner.md` > 本 `Plans.md`。起票 = GitHub issue cscartjp/even-app-one#36。スコープは **`apps/g2hermes` のグラス UI のみ**（Bridge / STT / コンパニオンは無改変）。
>
> **確定方針**: `transcribing` = 流れるドット（`●────`→`────●` ループ）、`thinking` = 8 方向矢印（`▲◥▶◢▼◣◀◤`・45°刻み）、`recording` = 静的 `REC ●` 据え置き（BLE 過負荷回避）。グリフは公式グリフ表で収録確認済み。フォールバックは線スピナー `│╱─╲`。
>
> **team_validation_mode**: `manual-pass`（2026-06-09。issue 本文＋コメントが subagent 調査 + Codex グリフ収録検証を内包。本計画化にあたり現コードと even-toolkit 内部を一次照合: ① `reducer.ts` は純関数で `frame` 未導入・`BACK→initialState` テスト在り〔`State` への `frame` 追加でフィクスチャ更新要〕、② `screen.ts` に transcribing/thinking/recording 分岐が実在、③ `AppGlasses.tsx` は `state`/`dispatch` props + `snapshotRef={...state,presets}` + 100ms ポーリング再描画、④ flicker-free 経路 `useGlasses.ts:107-110`→`bridge.ts:413-416`〔`updateHomeText`→`textContainerUpgrade`〕を実ファイルで確認。本アプリは画像 0・home 固定で経路に乗る。設計の load-bearing な主張はすべて現状コードと一致）。
>
> **lint/format baseline**: TS = biome（既存・設置済み）。新規設置不要。
> **前提**: Phase 3 の状態機械（`glass/reducer.ts` の `Phase`・`screen.ts` の display 分岐）が稼働中。

### 設計（3 点の変更）

1. **`reducer.ts`**: `State` に `frame:number` 追加、`TICK` イベントで `+1`、フェーズ入場（`STOP_RECORDING`→transcribing / `ASK`→thinking）で `frame=0` リセット。純関数維持。
2. **`AppGlasses.tsx`**: `phase ∈ {thinking, transcribing}` の間だけ `setInterval(~180–200ms)` で `TICK` dispatch、フェーズ離脱で `clearInterval`（`useEffect` 依存 `state.phase`）。
3. **`screen.ts`**: transcribing/thinking 分岐でスピナー文字を `frame % glyphs.length` で行末に出す（recording は無改変）。

安全性: `useGlasses` の `textBusy`+`pending` コアレスで BLE が詰まれば自動間引き。非等幅対策はスピナーを行末・流れるドットは専用 1 行。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 4.1 | グリフ先行検証スパイク。シミュレーターで `▲◥▶◢▼◣◀◤` / `●─` / フォールバック `│╱─╲` の実描画をテキスト出力 + スクショで確認（`test-with-simulator` / `simulator-automation`）[tdd:skip:throwaway-spike] | 8 方向矢印と流れるドットがシミュレーターで滲まず描画されることをスクショで確認。矢印が滲む/出ない→線スピナー `│╱─╲` にフォールバック決定、流れるドットの横揺れが目立つ→ドット数削減/固定幅化を決定。判断を本 Phase に追記 | - | cc:完了（実機目視 PASS・矢印滲まず＝線スピナー fallback 不採用で確定） |
| 4.2 | `reducer.ts` に `frame` + `TICK` を TDD で追加。`State.frame:number`、`TICK`→`frame+1`、`STOP_RECORDING`/`ASK` で `frame=0` リセット。`reducer.test.ts` に TICK テスト追加 + `State` 追加に伴う既存フィクスチャ更新 [tdd:required] | `bun test` green: TICK で frame 増加 / 他 state（phase/pages/transcript 等）不変 / transcribing・thinking 入場で frame=0 / 既存遷移テスト（`BACK→initialState` 含む）green 維持。`biome check` 0 | - | cc:完了 [f99fdd3] |
| 4.3 | `screen.ts` の transcribing / thinking 分岐にスピナー文字（`frame % glyphs.length`・行末）。transcribing=流れるドット、thinking=8 方向矢印（4.1 で滲めばフォールバック）、recording=静的 `REC ●` 無改変。display は純関数なので frame→glyph を unit テスト [tdd:required] | `bun test` green: transcribing が frame で流れるドット位置を返す / thinking が frame で 8 方向矢印を返す / recording が静的 `REC ●` のまま（無改変回帰）。`biome check` 0・`bun run build` 成功 | 4.1, 4.2 | cc:完了 [f99fdd3] |
| 4.4 | `AppGlasses.tsx` で `phase ∈ {thinking, transcribing}` の間だけ `setInterval(~180–200ms)` で `TICK` dispatch、離脱で `clearInterval`（`useEffect` 依存 `state.phase`）。thinking→answer/error・transcribing→review/error・BACK・unmount で確実に停止 [tdd:skip:integration-effect] | `bun run build` 成功・`biome check` 0。`useEffect` クリーンアップで `clearInterval` が全離脱経路で発火（コードレビューで確認）。ちらつき無し経路維持＝`updateHomeText`→`textContainerUpgrade` に乗り `rebuildPageContainer` に落ちない（画像 0・home 固定を崩さない） | 4.2, 4.3 | cc:完了 [f99fdd3] |
| 4.5 | シミュレーター/実機 E2E + パッケージング判断。シミュレーターで thinking の回転を目視（transcribing は実機マイク経路のため実機で）。フェーズ抜けで停止・ちらつき無しを確認。version bump + `evenhub pack` + 実機最終確認はユーザー [tdd:skip:integration-e2e] | シミュレーターで thinking スピナー回転 + フェーズ抜けで停止 + ちらつき無しを目視、console エラー0。`bun test` 全 green・`biome check` 0・`bun run build` 成功。transcribing アニメ・version bump・pack はユーザー（実機） | 4.4 | cc:完了（v0.2.3 bump+pack 済 PR#43・実機で thinking 回転 & 文字起こし中バー動作をユーザー確認） |

> **実装メモ（2026-06-09・f99fdd3）**: コア 4.2/4.3/4.4 を TDD で実装・コミット済（bun test 95 pass・biome 0・build 成功・app.json 不変）。glyph は確定方針どおり `thinking`=8 方向矢印・`transcribing`=流れるドット（●幅5）を採用。グリフ収録は Codex 検証済み。**Phase 4 完了（2026-06-09）**: v0.2.3 へ bump + `g2hermes-v0.2.3.ehpk` 生成（PR #43 `d43c460`）、**実機でユーザーが thinking の 8 方向矢印回転と文字起こし中の流れるバーを確認・矢印は滲まず**＝線スピナー `│╱─╲` への fallback は不採用で確定（4.1/4.5 とも cc:完了）。recording は設計どおり静的 `REC ●`（アニメ無し・BLE 負荷回避）。

### Phase 4 スコープ外（YAGNI）

- `recording` のアニメ化（BLE 過負荷で不採用）。
- 画像ベースのスピナー（BLE fps 不足で不採用）。
- 1 行に両スタイル併記（情報過多）。
- streaming 途中字幕・TTS・Bridge / STT / コンパニオンの変更。

### Phase 4 プロセス

ブランチを切る → PR 前に Codex Review（`/codex:review` 正規ルート）→ PR → bot レビューループ（CodeRabbit / Copilot / CI green）→ squash merge。

---

## Phase 7: TTS 実機プローブ（音声応答の実装可否を実機で確定）

> **G2 Hermes ワークストリーム**（`apps/g2hermes` のみ。Bridge / STT / コンパニオン / `apps/hisho` は無改変）。
> Spec delta: `docs/spec/g2-hermes-tts-probe.md` を新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-phase3-voice.md` > `g2-hermes-tts-probe.md` > 本 `Plans.md`。
> **目的**: 回答テキストの音声読み上げ（方式1 Web Speech API が本命 / 方式2-3 は MP3）の実装可否を、**ユーザー実機 iPhone で前面/背面の鳴動可否**として確定する。本実装ではなく feasibility probe。
> **確定事実（調査済み・2026-06-11）**: WebView=Flutter（iOS=WKWebView）。Android System WebView は `speechSynthesis` 非対応（方式1は実質 iPhone 専用）。WKWebView は**背面化・画面ロックで音声停止**の既知バグ（方式1/2/3 共通の壁）。iOS は**初回 speak() に user activation を要求**する版あり。→ 机上断定不能、実機プローブで決める。
> **Skeptic 反映**: 前面で鳴らない場合に「ジェスチャ制約」か「背面suspend」かを弁別するため、**自動発話（回答後タップ無し）と ジェスチャ発話（タップ/CLICK 起点）の両方を測る**。
> **非破壊の核**: プローブは `VITE_TTS_PROBE`（既定 OFF）でのみ有効。OFF 時 `ask.ts` はバイト等価（フック完全 no-op）。**ネットワークは増やさない**（on-device TTS + data-URI のみ・whitelist/CORS 変更なし）。
> team_validation_mode: `manual-pass`（`everything-evenhub:sdk-reference` で WebView=Flutter を確認・Web 一次情報を複数ソースでクロスチェック・コードベースは Explore サブエージェントで地図化・memory `g2-hermes-bridge-progress` 参照）。Product/Architecture/Security/QA/Skeptic を単独で分けて評価済。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 7.0 | プローブ足場: `app.json` version 0.2.6→0.2.7、`VITE_TTS_PROBE` フラグを `vite-env.d.ts` の `ImportMetaEnv` に追加（既定 OFF・Vite が `VITE_` env を `import.meta.env` に自動注入するため `define` 不要）。sub-spec は作成済 [tdd:skip:build-config] | `tsc -b` エラー 0・`bun run build` 成功・`git diff app.json` が version のみ・フラグ未設定時 `import.meta.env.VITE_TTS_PROBE` が falsy | - | cc:完了 |
| 7.1 | ピュア probe コア `apps/g2hermes/src/audio/ttsProbe.ts`: capability 検出（`'speechSynthesis' in window` / `getVoices()` を `voiceschanged` で settle し ja-JP 有無）、verdict→グラス1行整形（例 `🔊spk=Y aud=N v=3`）、gate 判定（`VITE_TTS_PROBE` falsy なら何もしない）。`window.speechSynthesis` を mock してテスト [tdd:required] | capability 整形・verdict 整形・gate のユニットテスト green（mock で voices 0件/ja有/未対応の3系統）・副作用 import なし | 7.0 | cc:完了 |
| 7.2 | `ask.ts` への最小フック: `ANSWERED` dispatch 直前にプローブ呼び出し。**フラグ OFF で完全 no-op（既存テスト不変・dispatch 列が等価）**。ON のとき verdict 1 行を回答 pages 末尾に追記してグラス表示 [tdd:required] | フラグ OFF で `runAsk` の dispatch（ASK→ANSWERED）が現行と等価なテスト green・ON で pages 末尾に verdict 行が付くテスト green・`biome check` 0 | 7.1 | cc:完了 |
| 7.3 | 実発話ランナー（device-io）: `SpeechSynthesisUtterance`(lang ja-JP) の `speak()` と data-URI 短音の `new Audio().play()` を実行し、`onerror`/promise reject を捕捉して結果を返す。**自動発話（回答後）と ジェスチャ発話（グラス CLICK / 送信タップ起点）の2経路**を用意 [tdd:skip:device-io] | ビルドに含まれ・前面で console に capability と各経路の試行結果が出る（Safari Web Inspector で確認可）・型チェック/biome 0 | 7.2 | cc:完了 |
| 7.4 | 検証 + プローブ用 `.ehpk`: `bun test` green / `biome check` 0 / `bun run build` 成功。**`.env` のある場所で `VITE_TTS_PROBE=1` でビルド → `evenhub pack`（直叩き・build→pack 順）**。bundle 検証: 実 BASE 値・version 0.2.7 を `rg` でヒット確認、ENV 未設定警告がログに無い [tdd:skip:verify] | 3 コマンド green + `g2hermes-tts-probe.ehpk` 生成 + bundle `rg` 検証 PASS（実 BASE 値・0.2.7） | 7.3 | cc:完了 |
| 7.5 | **実機 E2E プローブ（ユーザー実施）**: iPhone へサイドロード。matrix を取る — ②前面・自動 / ③前面・ジェスチャ / ④背面(画面ロック)・自動 × {`speechSynthesis`, `Audio`}。各セルの鳴動可否を聴覚＋グラス verdict 行で記録。前面は Safari Web Inspector で `getVoices()` も確認 [tdd:skip:integration-e2e] | 鳴動可否 matrix が記録され、方式1の go/no-go と「ジェスチャ制約 vs 背面suspend」の弁別が付く。実機はユーザー | 7.4 | cc:完了（Android で matrix 取得・方式2/3 go・方式1 no-go 確定。iOS は iPhone 未所持で保留＝意思決定に必要な go/no-go は確定） |
| 7.6 | 結論を sub-spec / memory（`g2-hermes-bridge-progress`）に反映し、次手を分岐記録（前面OK→方式1本実装へ新 Phase / 背面必須→Even 社へネイティブ再生 API 要望） [tdd:skip:docs] | sub-spec に matrix 結果と判断・memory 更新・次 Phase の方針 1 行 | 7.5 | cc:完了（probe spec 7.6 更新＝本線を方式2 Aivis に確定・memory `g2-hermes-tts-probe-result` 反映済・次 Phase=Phase 8 本実装を `g2-hermes-voice-answer.md` で起票） |

**Phase 7 プロセス**: ブランチ `feat/g2hermes-tts-probe` → コード作業前に `andrej-karpathy-skills:karpathy-guidelines` invoke → Codex Review（`/codex:review`）→ PR → bot レビューループ（CodeRabbit / Copilot / CI green）→ squash merge。プローブ `.ehpk` のサイドロードと matrix 取得はユーザー。

### Phase 7 スコープ外

- MP3 生成（Bridge）/ `audioUrl` 配信 / network whitelist 追加 / CORS（方式2-3 の本実装。プローブはネットワークを増やさない）。
- 本番読み上げ UX（停止制御・ページ同期・話速/音声選択）。
- Android 対応（System WebView が `speechSynthesis` 非対応のため方式1では原理的に不可。必要なら別途ネイティブ polyfill 検討）。

> **結論（go/no-go）**: Android = go（方式2/3＝サーバ生成音声を `new Audio()` で前面・背面とも再生可）。方式1（Web Speech）は Android 非対応で no-go。iOS は iPhone 未所持で未判定。**本実装の本線は方式2（AivisSpeech・WAV）= Phase 8（`docs/spec/g2-hermes-voice-answer.md`）へ**。詳細は `docs/spec/g2-hermes-tts-probe.md`。
