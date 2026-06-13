import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Routes } from 'react-router'
import { Companion } from './companion/Companion'
import { AppGlasses } from './glass/AppGlasses'
import { loadDesignParams, saveDesignParams } from './params/storage'
import { DEFAULT_DESIGN_PARAMS, type DesignParams } from './params/types'

function Home() {
  const [params, setParams] = useState<DesignParams>(DEFAULT_DESIGN_PARAMS)
  const dirtyRef = useRef(false)

  useEffect(() => {
    let alive = true
    void loadDesignParams().then((saved) => {
      if (alive && !dirtyRef.current) setParams(saved)
    })
    return () => {
      alive = false
    }
  }, [])

  const handleParamsChange = useCallback((next: DesignParams) => {
    dirtyRef.current = true
    setParams(next)
    void saveDesignParams(next)
  }, [])

  return (
    <>
      <Companion params={params} onParamsChange={handleParamsChange} />
      <AppGlasses params={params} onParamsChange={handleParamsChange} />
    </>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/*" element={<Home />} />
    </Routes>
  )
}
