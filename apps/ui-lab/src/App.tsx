import { AppShell, NavHeader, ScreenHeader } from 'even-toolkit/web'
import { Route, Routes } from 'react-router'

function Home() {
  return (
    <AppShell header={<NavHeader title="UI Lab" />}>
      <div className="px-3 pt-4 pb-8">
        <ScreenHeader
          title="UI Lab"
          subtitle={`Glasses design sandbox v${__APP_VERSION__}`}
        />
      </div>
    </AppShell>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/*" element={<Home />} />
    </Routes>
  )
}
