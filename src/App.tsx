import { useLayoutEffect } from 'react'
import { MapScreen } from './app/MapScreen'
import { ModelMenu } from './features/model-menu/ModelMenu'
import { useAppStore } from './state/store'
import { useTheme } from './state/theme'

// The phone's status bar color on Android: `surface` on the map, and
// `background` behind the model menu's cards.
const STATUS_BAR = {
  map: { light: '#FFFFFF', dark: '#1C1C1E' },
  menu: { light: '#F4F4F2', dark: '#0E0E0F' },
}

function App() {
  const theme = useTheme()
  const screen = useAppStore((s) => s.screen)

  // The theme picks the UI colors (theme.css) and the status bar color.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.screen = screen
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )) {
      meta.content = STATUS_BAR[screen][theme]
    }
  }, [theme, screen])

  return screen === 'menu' ? <ModelMenu /> : <MapScreen />
}

export default App
