export interface AppSnapshot {
  items: string[]
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
}
