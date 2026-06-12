import { AppShell, NavHeader, ScreenHeader } from 'even-toolkit/web'
import { useCallback, useState } from 'react'
import { Route, Routes } from 'react-router'
import { AppGlasses } from './glass/AppGlasses'
import { DEFAULT_DESIGN_PARAMS, type DesignParams } from './params/types'

function Home() {
  const [params, setParams] = useState<DesignParams>(DEFAULT_DESIGN_PARAMS)
  const handleParamsChange = useCallback((next: DesignParams) => {
    setParams(next)
  }, [])

  return (
    <AppShell header={<NavHeader title="UI Lab" />}>
      <div className="px-3 pt-4 pb-8">
        <ScreenHeader
          title="UI Lab"
          subtitle={`Glasses design sandbox v${__APP_VERSION__}`}
        />
      </div>
      <AppGlasses params={params} onParamsChange={handleParamsChange} />
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
