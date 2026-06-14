import { useReducer } from 'react'
import { ImuLab } from './companion/ImuLab'
import { AppGlasses } from './glass/AppGlasses'
import { initialState, reduce } from './imu/reducer'
import { useImu } from './imu/useImu'

/**
 * IMU Lab — スマホ WebView クライアント。
 * 状態の正本は useReducer。useImu がブリッジ配線（IMU 開閉・購読・電池）を担い
 * dispatch に流す。同じ state を ImuLab（主計測 UI）と AppGlasses（グラス副表示）が読む。
 */
export function App() {
  const [state, dispatch] = useReducer(reduce, initialState)
  const controls = useImu(dispatch)

  return (
    <>
      <ImuLab state={state} dispatch={dispatch} controls={controls} />
      <AppGlasses state={state} controls={controls} />
    </>
  )
}
