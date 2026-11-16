import { useEffect, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { Info, Minus, Plus, Search, Settings } from 'lucide-react'

// Round 44 px map buttons (Weeks 5 to 7): `surface` fill, a 1 px `border`
// edge and the soft shadow, so they show on both basemaps.

export function TopButtons({
  onSearch,
  onSettings,
}: {
  onSearch: () => void
  onSettings: () => void
}) {
  return (
    <div className="top-buttons">
      <button
        type="button"
        className="map-button"
        aria-label="Search places"
        onClick={onSearch}
      >
        <Search size={22} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="map-button"
        aria-label="Settings"
        onClick={onSettings}
      >
        <Settings size={22} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}

// + over −, one zoom level per tap; disabled at the closest and widest
// zoom (Week 7, for WCAG 2.5.1: zooming out otherwise takes two fingers).
export function ZoomButtons({ map }: { map: MapLibreMap | null }) {
  const [zoom, setZoom] = useState<{ canIn: boolean; canOut: boolean }>({
    canIn: true,
    canOut: true,
  })
  useEffect(() => {
    if (!map) return
    const update = () =>
      setZoom({
        canIn: map.getZoom() < map.getMaxZoom() - 0.01,
        canOut: map.getZoom() > map.getMinZoom() + 0.01,
      })
    map.on('zoomend', update)
    return () => {
      map.off('zoomend', update)
    }
  }, [map])
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches
  const options = { animate: !reduceMotion }
  return (
    <div className="zoom-buttons">
      <button
        type="button"
        className="map-button"
        aria-label="Zoom in"
        aria-disabled={!zoom.canIn}
        onClick={() => zoom.canIn && map?.zoomIn(options)}
      >
        <Plus size={22} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="map-button"
        aria-label="Zoom out"
        aria-disabled={!zoom.canOut}
        onClick={() => zoom.canOut && map?.zoomOut(options)}
      >
        <Minus size={22} strokeWidth={2} aria-hidden />
      </button>
    </div>
  )
}

// A small (i) button (28 px, 44 px tap area) that opens the map credits
// sheet; replaces MapLibre's attribution strip (Week 6).
export function CreditsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="credits-button"
      aria-label="Map credits"
      aria-haspopup="dialog"
      onClick={onOpen}
    >
      <span className="credits-button-face">
        <Info size={18} strokeWidth={2} aria-hidden />
      </span>
    </button>
  )
}
