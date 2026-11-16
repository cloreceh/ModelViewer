import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre draws map data in a background worker. Point it at the worker
// file explicitly so Vite includes it in both dev and production builds.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { BASEMAP_STYLES, OPENING_VIEW, tuneBasemap } from './basemap'
import { nationOutline, stateLines } from './boundaries'
import { applyUnits, registerOmProtocol } from './omProtocol'
import {
  addProductLayers,
  removeProductLayers,
  updateProductLayers,
  type ProductContext,
  type Theme,
} from './productLayers'
import type { ProductRuns } from '../data/useProductRuns'
import type { UnitSettings } from '../lib/units'

maplibregl.setWorkerUrl(workerUrl)
registerOmProtocol()

interface Props {
  theme: Theme
  units: UnitSettings
  runs?: ProductRuns // undefined while a new model or product loads
  frameTime?: Date // the valid time to draw
  padding: { top: number; bottom: number }
  label: string // what screen readers hear for the map region
  onMap: (map: maplibregl.Map | null) => void
  onError: (message: string) => void
}

const debug = new URLSearchParams(window.location.search).has('debug')

// The map itself. It's made once per theme (the basemap style changes with
// it); model, product, units and hour changes swap or repoint the weather
// layers on the same map, so the view stays where it is.
export function MapView({
  theme,
  units,
  runs,
  frameTime,
  padding,
  label,
  onMap,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  // The weather now on the map, and the hour it shows.
  const shownRef = useRef<{ ctx: ProductContext; time: number } | null>(null)
  // The map view, kept when the theme changes and the map is rebuilt.
  const viewRef = useRef({
    center: OPENING_VIEW.center as maplibregl.LngLatLike,
    zoom: OPENING_VIEW.zoom,
  })
  const [styleReady, setStyleReady] = useState<maplibregl.Map | null>(null)
  const onMapRef = useRef(onMap)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onMapRef.current = onMap
    onErrorRef.current = onError
  })

  // Create the map (again when the theme changes).
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES[theme],
      center: viewRef.current.center,
      zoom: viewRef.current.zoom,
      // Keep the map flat and north-up, like other model viewers.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Credits are in the map credits sheet instead (Week 6).
      attributionControl: false,
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map
    shownRef.current = null
    // ?debug exposes the map in the browser console (window.__map) for checks.
    if (debug) (window as unknown as { __map: maplibregl.Map }).__map = map

    // "style.load" fires as soon as the basemap style is read, before its
    // tiles arrive, so the weather download starts in parallel with them.
    map.once('style.load', () => {
      // Lighter roads and fewer labels, so the weather colors lead.
      tuneBasemap(map, theme)
      // Everything the app adds goes under the first label layer, so city
      // names stay on top of the weather colors.
      const firstLabelId = map
        .getStyle()
        .layers.find((l) => l.type === 'symbol')?.id
      const border =
        theme === 'dark' ? ['#9aa5b1', '#b5bec8'] : ['#5f6b78', '#4a5561']
      map.addSource('state-lines', { type: 'geojson', data: stateLines })
      map.addSource('nation-outline', { type: 'geojson', data: nationOutline })
      map.addLayer(
        {
          id: 'state-lines',
          type: 'line',
          source: 'state-lines',
          paint: { 'line-color': border[0], 'line-width': 0.8 },
        },
        firstLabelId,
      )
      map.addLayer(
        {
          id: 'nation-outline',
          type: 'line',
          source: 'nation-outline',
          paint: { 'line-color': border[1], 'line-width': 1.2 },
        },
        firstLabelId,
      )
      setStyleReady(map)
    })
    map.on('moveend', () => {
      viewRef.current = { center: map.getCenter(), zoom: map.getZoom() }
    })
    map.on('error', (event) =>
      onErrorRef.current(event.error?.message ?? 'Unknown map error'),
    )
    onMapRef.current(map)

    return () => {
      onMapRef.current(null)
      mapRef.current = null
      map.remove()
    }
  }, [theme])

  // Keep the US between the top buttons and the bottom panel. The padding
  // stays on the map, so later moves (search, zoom buttons) keep it too.
  useEffect(() => {
    mapRef.current?.setPadding({ ...padding, left: 0, right: 0 })
  }, [padding, theme])

  // Draw the weather: re-add the layers when the model, product or units
  // change; just point them at a new file when only the hour changes.
  useEffect(() => {
    const map = styleReady
    if (!map || map !== mapRef.current || !runs || !frameTime) return
    const shown = shownRef.current
    const time = frameTime.getTime()
    const ctx: ProductContext = {
      model: runs.model,
      product: runs.productId,
      runs: runs.runs,
      iemRun: runs.iemRun,
      units,
      theme,
    }
    const same =
      shown &&
      shown.ctx.model === ctx.model &&
      shown.ctx.product === ctx.product &&
      shown.ctx.runs === ctx.runs &&
      shown.ctx.units === ctx.units
    try {
      if (same) {
        if (shown.time !== time) updateProductLayers(map, ctx, frameTime)
      } else {
        if (shown) removeProductLayers(map, shown.ctx)
        if (shown?.ctx.units !== units) applyUnits(units)
        addProductLayers(map, ctx, frameTime, 'state-lines')
      }
      shownRef.current = { ctx, time }
    } catch (error) {
      onErrorRef.current((error as Error).message)
    }
  }, [styleReady, runs, frameTime, units, theme])

  return (
    <div ref={containerRef} className="map" role="region" aria-label={label} />
  )
}
