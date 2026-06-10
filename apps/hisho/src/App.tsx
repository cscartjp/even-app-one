import {
  AppShell,
  Button,
  Card,
  ListItem,
  NavHeader,
  ScreenHeader,
  SectionHeader,
} from 'even-toolkit/web'
import { Route, Routes } from 'react-router'
// 🧪 SPIKE (issue #37 Phase 6.1): カード化ホームの見た目を実機確認するため、本番
// AppGlasses の代わりに AppGlassesCardSpike を一時マウントしている。Go なら本実装で
// AppGlasses に統合し、この差し替えと spike ファイルを破棄する。
import { AppGlassesCardSpike } from './glass/AppGlassesCardSpike'

function Home() {
  return (
    <AppShell header={<NavHeader title="Hisho" />}>
      <div className="space-y-3 px-3 pt-4 pb-8">
        <ScreenHeader title="Welcome" subtitle="Your G2 glasses app is ready" />

        <Card>
          <ListItem
            title="Get started"
            subtitle="Edit src/App.tsx to build your app"
          />
          <ListItem
            title="Components"
            subtitle="55+ React components from even-toolkit"
          />
          <ListItem
            title="Glasses SDK"
            subtitle="G2 display, gestures, and speech-to-text"
          />
        </Card>

        <SectionHeader title="Quick links" />
        <div className="flex gap-2">
          <Button
            variant="highlight"
            size="sm"
            onClick={() =>
              window.open(
                'https://www.npmjs.com/package/even-toolkit',
                '_blank',
              )
            }
          >
            Toolkit Docs
          </Button>
          <Button
            variant="highlight"
            size="sm"
            onClick={() =>
              window.open('https://even-demo.vercel.app', '_blank')
            }
          >
            Component Demo
          </Button>
        </div>
      </div>
      <AppGlassesCardSpike />
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
