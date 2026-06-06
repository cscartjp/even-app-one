export interface MenuItem {
  label: string
  path: string
}

export interface AppSnapshot {
  menuItems: MenuItem[]
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
}
