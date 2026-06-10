import {
  CreateStartUpPageContainer,
  type EvenAppBridge,
  TextContainerProperty,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'

/** G2 ディスプレイ実寸（576×288px・4bit 緑階調） */
const DISPLAY_W = 576
const DISPLAY_H = 288

/** 4bit 緑 16 階調のうち、選択カード枠＝明 / 非選択カード枠＝暗 */
const BORDER_SELECTED = 15
const BORDER_DIM = 6

export interface HomeCardData {
  /** ヘッダ行（例: "最寄駅: 大保駅"） */
  stationLabel: string
  /** 電車カードの中身（1 行目=タイトル、以降=次発行） */
  trainLines: string[]
  /** グルメカードのタイトル（例: "グルメ情報"） */
  gourmetLabel: string
  /** 画面下のヒント行 */
  hint: string
  /** 選択中カード: 0=電車 / 1=グルメ */
  selectedIndex: 0 | 1
}

/** raw SDK の TextContainerProperty に渡す素の構成（テスト可能なピュア表現） */
export interface CardContainerConfig {
  containerID: number
  containerName: string
  xPosition: number
  yPosition: number
  width: number
  height: number
  borderWidth: number
  borderColor: number
  borderRadius: number
  paddingLength: number
  content: string
  isEventCapture: 0 | 1
}

/**
 * 🧪 SPIKE (issue #37 Phase 6.1): ホームの「電車情報 / グルメ情報」を
 * ネイティブ角丸枠（borderRadius）の text コンテナとして構成する純粋関数。
 * 高レベル line() は borderWidth:0 ハードコードのため raw SDK 直叩きを採る。
 * 選択は borderColor の明暗で表現する（spike は静的 1 枚＝選択/非選択を同時表示）。
 */
export function homeCardConfigs(data: HomeCardData): CardContainerConfig[] {
  const trainSelected = data.selectedIndex === 0
  return [
    // イベント捕捉用オーバーレイ（枠なし・全面・必ず 1 つだけ isEventCapture:1）
    {
      containerID: 1,
      containerName: 'overlay',
      xPosition: 0,
      yPosition: 0,
      width: DISPLAY_W,
      height: DISPLAY_H,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 0,
      content: '',
      isEventCapture: 1,
    },
    // ヘッダ（最寄駅・枠なし）
    {
      containerID: 2,
      containerName: 'header',
      xPosition: 12,
      yPosition: 4,
      width: DISPLAY_W - 24,
      height: 27,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 0,
      content: data.stationLabel,
      isEventCapture: 0,
    },
    // 電車カード（角丸枠・選択中は明るい枠）
    {
      containerID: 3,
      containerName: 'card-train',
      xPosition: 8,
      yPosition: 36,
      width: DISPLAY_W - 16,
      height: 96,
      borderWidth: 2,
      borderColor: trainSelected ? BORDER_SELECTED : BORDER_DIM,
      borderRadius: 7,
      paddingLength: 8,
      content: data.trainLines.join('\n'),
      isEventCapture: 0,
    },
    // グルメカード（角丸枠・選択中は明るい枠）
    {
      containerID: 4,
      containerName: 'card-gourmet',
      xPosition: 8,
      yPosition: 140,
      width: DISPLAY_W - 16,
      height: 44,
      borderWidth: 2,
      borderColor: trainSelected ? BORDER_DIM : BORDER_SELECTED,
      borderRadius: 7,
      paddingLength: 8,
      content: data.gourmetLabel,
      isEventCapture: 0,
    },
    // ヒント（枠なし）
    {
      containerID: 5,
      containerName: 'hint',
      xPosition: 12,
      yPosition: 196,
      width: DISPLAY_W - 24,
      height: 27,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 0,
      content: data.hint,
      isEventCapture: 0,
    },
  ]
}

/** ピュア構成を raw SDK の起動ページ容器に変換する */
export function buildHomeCardPage(
  data: HomeCardData,
): CreateStartUpPageContainer {
  const configs = homeCardConfigs(data)
  return new CreateStartUpPageContainer({
    containerTotalNum: configs.length,
    textObject: configs.map((c) => new TextContainerProperty(c)),
  })
}

/**
 * raw SDK でカード化ホームを 1 度だけ描画する（spike・静的）。
 * 初回描画なので createStartUpPageContainer を 1 回呼ぶ（even-toolkit と同じ起動順）。
 * SDK ブリッジ不在（Web プレビュー）では reject されるので呼び出し側で握りつぶす。
 */
export async function renderHomeCardSpike(data: HomeCardData): Promise<void> {
  const bridge: EvenAppBridge = await waitForEvenAppBridge()
  await bridge.createStartUpPageContainer(buildHomeCardPage(data))
}
