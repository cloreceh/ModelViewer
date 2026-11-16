import { useSyncExternalStore } from 'react'
import type { Theme } from '../map/productLayers'
import { useAppStore } from './store'

// Follows the phone's light or dark setting while the theme is "system".
const query = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const systemIsDark = () => window.matchMedia(query).matches

export function useTheme(): Theme {
  const setting = useAppStore((s) => s.theme)
  const dark = useSyncExternalStore(subscribe, systemIsDark)
  if (setting === 'system') return dark ? 'dark' : 'light'
  return setting
}
