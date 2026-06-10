import { defaultOrigin, type GeoPoint } from '../data/shops'
import { nearestStation } from '../data/stations'
import { getNextDepartures } from '../data/timetable'
import { statusBarLines } from './shared'

/** G2 ディスプレイ実寸（576×288px・4bit 緑階調） */
const DISPLAY_W = 576
const DISPLAY_H = 288

/** ホームの選択可能項目インデックス（home.ts と一致させること） */
export const HOME_STATION_INDEX = 0
export const HOME_TRAIN_INDEX = 1
export const HOME_GOURMET_INDEX = 2

/** 選択カーソル。選択行は '▶ '、非選択行は同じ幅の空白で左端を揃える（無ちらつき） */
const CURSOR_SELECTED = '▶ '
const CURSOR_UNSELECTED = '  '

/** カード枠（角丸）。選択はカーソル文字で表すため枠色は静的（rebuild を伴うトグルを避ける） */
const CARD_BORDER_WIDTH = 2
const CARD_BORDER_COLOR = 12
const CARD_BORDER_RADIUS = 7
const CARD_PADDING = 8

/** home カードコンテナの固定 ID（rebuild / textContainerUpgrade で共用） */
export const HOME_CONTAINER_ID = {
  overlay: 1,
  statusBar: 2,
  station: 3,
  train: 4,
  gourmet: 5,
  hint: 6,
} as const

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

export interface HomeCardModel {
  /** ステータスバー（HISHO v… ＋ 右寄せ時計） */
  statusBar: string
  /** 最寄駅ラベル（例: "最寄駅: 大保駅" / 固定時は "(固定)"） */
  stationLabel: string
  /** 電車カードの中身（1 行目=タイトル、以降=次発行） */
  trainLines: string[]
  /** グルメカードのタイトル */
  gourmetLabel: string
  /** 画面下のヒント行 */
  hint: string
  /** 選択中インデックス（0=最寄駅 / 1=電車 / 2=グルメ） */
  highlightedIndex: number
}

/** 次発時刻を "HH:MM" で返す（home.ts と同じ規則・空なら "--:--"） */
function nextDepartureTime(
  dir: Parameters<typeof getNextDepartures>[0],
  now: Date,
): string {
  const deps = getNextDepartures(dir, now, 1)
  return deps.length === 0 ? '--:--' : deps[0].time
}

/**
 * snapshot + nav から home カードの表示モデルを作る。
 * 駅・次発時刻の算出は home.ts（テキスト版）と同じロジックを踏襲する。
 */
export function homeCardModel(
  origin: GeoPoint,
  selectedStation: string | null,
  highlightedIndex: number,
  now: Date = new Date(),
): HomeCardModel {
  const station = nearestStation(origin)
  const stationLabel =
    selectedStation !== null
      ? `最寄駅: ${station.name}駅(固定)`
      : `最寄駅: ${station.name}駅`

  const firstDir = station.directions[0]
  const trainLines = [
    '電車情報',
    `  次発 ${nextDepartureTime(firstDir, now)}  ${firstDir.label}`,
    ...station.directions.slice(1).map((dir) => {
      return `       ${nextDepartureTime(dir, now)}  ${dir.label}`
    }),
  ]

  return {
    statusBar: statusBarLines(now)[0].text,
    stationLabel,
    trainLines,
    gourmetLabel: 'グルメ情報',
    hint: '↕選択 タップ決定',
    highlightedIndex,
  }
}

/** 既定原点（GPS 不在）の home モデル。プレビュー/テストの足場として使う */
export function defaultHomeCardModel(
  highlightedIndex = HOME_TRAIN_INDEX,
  now: Date = new Date(),
): HomeCardModel {
  return homeCardModel(defaultOrigin, null, highlightedIndex, now)
}

/** 選択カーソルを行頭に付ける（選択中=▶ / 非選択=空白で左端揃え） */
function withCursor(text: string, selected: boolean): string {
  return `${selected ? CURSOR_SELECTED : CURSOR_UNSELECTED}${text}`
}

/**
 * 🃏 issue #37 Phase 6.2: ホームを「最寄駅 + 電車カード + グルメカード」で構成する純粋関数。
 * 電車情報 / グルメ情報をネイティブ角丸枠（borderRadius）の text コンテナにする。
 * 高レベル line() は borderWidth:0 ハードコードのため raw SDK 直叩きを採る。
 * 選択は行頭カーソル（content 更新＝textContainerUpgrade で無ちらつき）で表す。
 */
export function homeCardConfigs(model: HomeCardModel): CardContainerConfig[] {
  const i = model.highlightedIndex
  const noBorder = {
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    paddingLength: 0,
  }
  const cardBorder = {
    borderWidth: CARD_BORDER_WIDTH,
    borderColor: CARD_BORDER_COLOR,
    borderRadius: CARD_BORDER_RADIUS,
    paddingLength: CARD_PADDING,
  }

  // 電車カードはタイトル行だけにカーソルを付け、次発行はそのまま
  const trainContent = [
    withCursor(model.trainLines[0] ?? '電車情報', i === HOME_TRAIN_INDEX),
    ...model.trainLines.slice(1),
  ].join('\n')

  return [
    // イベント捕捉用オーバーレイ（枠なし・全面・必ず 1 つだけ isEventCapture:1）
    {
      containerID: HOME_CONTAINER_ID.overlay,
      containerName: 'overlay',
      xPosition: 0,
      yPosition: 0,
      width: DISPLAY_W,
      height: DISPLAY_H,
      ...noBorder,
      content: '',
      isEventCapture: 1,
    },
    // ステータスバー（HISHO v… + 時計・枠なし）
    {
      containerID: HOME_CONTAINER_ID.statusBar,
      containerName: 'status',
      xPosition: 10,
      yPosition: 2,
      width: DISPLAY_W - 20,
      height: 26,
      ...noBorder,
      content: model.statusBar,
      isEventCapture: 0,
    },
    // 最寄駅（選択可能・枠なし）
    {
      containerID: HOME_CONTAINER_ID.station,
      containerName: 'station',
      xPosition: 10,
      yPosition: 30,
      width: DISPLAY_W - 20,
      height: 26,
      ...noBorder,
      content: withCursor(model.stationLabel, i === HOME_STATION_INDEX),
      isEventCapture: 0,
    },
    // 電車カード（角丸枠・選択可能）
    {
      containerID: HOME_CONTAINER_ID.train,
      containerName: 'card-train',
      xPosition: 8,
      yPosition: 58,
      width: DISPLAY_W - 16,
      height: 92,
      ...cardBorder,
      content: trainContent,
      isEventCapture: 0,
    },
    // グルメカード（角丸枠・選択可能）
    {
      containerID: HOME_CONTAINER_ID.gourmet,
      containerName: 'card-gourmet',
      xPosition: 8,
      yPosition: 154,
      width: DISPLAY_W - 16,
      height: 44,
      ...cardBorder,
      content: withCursor(model.gourmetLabel, i === HOME_GOURMET_INDEX),
      isEventCapture: 0,
    },
    // ヒント（枠なし）
    {
      containerID: HOME_CONTAINER_ID.hint,
      containerName: 'hint',
      xPosition: 10,
      yPosition: 204,
      width: DISPLAY_W - 20,
      height: 26,
      ...noBorder,
      content: model.hint,
      isEventCapture: 0,
    },
  ]
}
