import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'

// Phase 3 / Task 3.0 の gating spike 用マイク probe。
// 目的は「実機で audioControl(true) → audioEvent.audioPcm が届くか」を確認すること
// だけ（GPS 権限が実機で取れなかった前例があるため・Plans.md「Phase 3 の gating」）。
// 本番の音声入力は Task 3.4 で even-toolkit GlassBridgeSource を使って作り直すので、
// この probe は SDK 直叩きの最小実装としてこのファイルに隔離し、後で剥がしやすくする。

// SDK が注入されない環境（ブラウザプレビュー・シミュレーター）では
// waitForEvenAppBridge() が解決しないため、この時間で諦める（bridge.ts と同じ方針）。
const BRIDGE_WAIT_MS = 1500

/** 先頭バイトを何バイトまで記録するか（PCM の signed/endian の当たりを付ける用）。 */
const FIRST_BYTES_SAMPLE = 8

/** probe の観測結果。グラスに表示し、console にも出す。 */
export interface MicProbeStats {
  /** audioControl(true) の戻り値（権限/起動の成否） */
  started: boolean
  /** audioPcm イベントを受け取った回数 */
  events: number
  /** 受信した PCM の総バイト数 */
  totalBytes: number
  /** 最初に受信したイベントの byteLength（0 = 未受信） */
  firstByteLength: number
  /** 最初のイベントの先頭バイト（最大 FIRST_BYTES_SAMPLE 個） */
  firstBytes: number[]
  /** SDK 未注入・例外時のメモ（正常時は null） */
  note: string | null
}

/** 起動中の probe ハンドル。stop() でマイクを閉じ最終 stats を返す。 */
export interface MicProbeHandle {
  stop: () => Promise<MicProbeStats>
}

function emptyStats(): MicProbeStats {
  return {
    started: false,
    events: 0,
    totalBytes: 0,
    firstByteLength: 0,
    firstBytes: [],
    note: null,
  }
}

/**
 * マイク probe を開始する。audioControl(true) を呼び、onEvenHubEvent で audioPcm を観測する。
 * 受信のたびに onUpdate(stats) を呼ぶので、呼び出し側は React state を更新してグラスに反映する。
 * SDK が無い環境では started=false / note 付きの stats を即時に確定して返す。
 */
export async function startMicProbe(
  onUpdate: (stats: MicProbeStats) => void,
): Promise<MicProbeHandle> {
  const stats = emptyStats()

  const bridge = await Promise.race([
    waitForEvenAppBridge(),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), BRIDGE_WAIT_MS),
    ),
  ])

  if (!bridge) {
    stats.note = 'SDK 未注入（プレビュー/シミュレーター）'
    onUpdate({ ...stats })
    return { stop: async () => ({ ...stats }) }
  }

  let unsubscribe: (() => void) | null = null
  try {
    stats.started = await bridge.audioControl(true)
    console.log('[mic-probe] audioControl(true) =>', stats.started)

    unsubscribe = bridge.onEvenHubEvent((event) => {
      const pcm = event.audioEvent?.audioPcm
      if (!pcm) return
      stats.events += 1
      stats.totalBytes += pcm.byteLength
      if (stats.firstByteLength === 0) {
        stats.firstByteLength = pcm.byteLength
        stats.firstBytes = Array.from(pcm.slice(0, FIRST_BYTES_SAMPLE))
        console.log(
          '[mic-probe] first audioPcm: byteLength=',
          pcm.byteLength,
          'firstBytes=',
          stats.firstBytes,
        )
      }
      onUpdate({ ...stats })
    })
  } catch (e) {
    stats.note = `例外: ${e instanceof Error ? e.message : String(e)}`
    console.error('[mic-probe] error', e)
  }
  onUpdate({ ...stats })

  return {
    stop: async () => {
      unsubscribe?.()
      try {
        if (bridge) await bridge.audioControl(false)
      } catch (e) {
        console.error('[mic-probe] audioControl(false) error', e)
      }
      console.log('[mic-probe] stopped', stats)
      return { ...stats }
    },
  }
}
