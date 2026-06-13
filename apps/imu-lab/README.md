# IMU Lab — Even G2 IMU 計測スパイク

`docs/spec/imu-posture-spike.md` の feasibility probe を実装したアプリ。
「3軸モーション（猫背検知）アプリ」本実装の前に、**実機で IMU の前提を確定する**ための計測ツール。

非公式・個人の趣味プロジェクト（Even Realities 社とは無関係）。

## これで埋める前提（spec の matrix）

- `x/y/z` の素性（加速度か／単位・レンジ／静止ノルム／前傾でどの軸が動くか）
- `ImuReportPace`（P100/P500/P1000）の実効レート
- キャリブレーション基準との角度差 θ（猫背指標）が体感前傾と一致するか
- 歩行ノイズを移動平均（1.5s 窓）で除けるか
- スマホ振動フィードバック（`navigator.vibrate`）が実機で効くか
- バッテリー消費（計測開始からの差分）
- 権限（`permissions: []` で IMU が取れるか）

## 使い方

```bash
bun install                 # ルートで一度
bun run --filter imu-lab dev   # もしくは apps/imu-lab で bun run dev（:5175）
bun run --filter imu-lab test  # 純粋ロジックのユニットテスト
```

実機検証は QR サイドロード（ホットリロード対応）:

```bash
evenhub qr --url "http://<PCのIP>:5175"
```

### 画面操作

- **スマホ（主 UI）**: 計測 開始/停止・pace 切替・キャリブ・振動テスト・ログクリア・CSV コピー・各種数値。
- **グラス（副表示）**: タップ=計測 ON/OFF、↕（スクロール）=pace、ダブルタップ=終了。

### 計測の流れ

1. グラスを装着して「計測開始」
2. **良い姿勢で静止して「キャリブ」** → 基準ベクトル `g_ref` を記録
3. 歩く・うつむく → θ（基準からの傾き）と x/y/z を観測
4. 必要なら pace を変えてレート/電池を比較
5. 「CSV コピー」でログを持ち帰り、素性を分析

## 構成

```
src/
  imu/
    math.ts       ベクトル/角度/レート/CSV（純関数・テスト有）
    state.ts      共有状態 LabState + θ 算出
    reducer.ts    計測の状態遷移（純関数・テスト有）
    useImu.ts     ブリッジ配線（imuControl/onEvenHubEvent/電池/振動）
    glass.ts      グラス行生成（純関数・テスト有）
  glass/
    screen.ts     GlassScreen（display/action）
    AppGlasses.tsx useGlasses 配線
  even/bridge.ts  終了（shutDownPageContainer）
  companion/ImuLab.tsx  主計測 UI
  App.tsx / main.tsx
```

> ⚠️ IMU は実機のみ（シミュレーター非対応）。電池消費が大きいため使うときだけ計測する。
