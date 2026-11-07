import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre draws map data in a background worker. Point it at the worker
// file explicitly so Vite includes it in both dev and production builds.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { omProtocol } from '@openmeteo/weather-map-layer'
import { BASEMAP_STYLES, CONUS_BOUNDS } from './basemap'
import { nationOutline, stateLines } from './boundaries'
import {
  SPIKE_LAYERS,
  addSpikeLayer,
  firstHourIndex,
  pickSpikeLayer,
  updateSpikeLayer,
} from './spikeLayers'
import {
  fetchLatestRun,
  forecastHour,
  type RunInfo,
} from '../data/openmeteo/runs'
import {
  IEM_LAST_MINUTE,
  fetchIemRun,
  iemMinute,
  type IemRun,
} from '../data/iem/reflectivity'

maplibregl.setWorkerUrl(workerUrl)
// Teach MapLibre to read om:// addresses (Open-Meteo weather files).
// Registered once, before any map is created.
maplibregl.addProtocol('om', omProtocol)

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const pad = (n: number) => String(n).padStart(2, '0')
const runName = (time: Date) => `${pad(time.getUTCHours())}Z`
const localTime = (time: Date) =>
  time.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    timeZoneName: 'short',
  })

// What the spike notes line shows (temporary, removed after the spikes).
interface SpikeStatus {
  run?: RunInfo
  iemRun?: IemRun
  hourIndex: number
  firstFrame?: number
  stepLoad?: number
  error?: string
}

export function MapView() {
  // A reference to the <div> the map draws into.
  const containerRef = useRef<HTMLDivElement>(null)
  // Lets the step buttons reach the map and its layers.
  const stepRef = useRef<(delta: number) => void>(() => {})
  const [status, setStatus] = useState<SpikeStatus>({ hourIndex: 0 })

  const layer = pickSpikeLayer()
  const { label, dataset } = SPIKE_LAYERS[layer]

  useEffect(() => {
    if (!containerRef.current) return
    let removed = false
    const fail = (error: { message: string }) =>
      !removed && setStatus((s) => ({ ...s, error: error.message }))

    // Start the run lookups right away, at the same time as the basemap
    // loads, instead of waiting for the map to be ready.
    const runRequest = fetchLatestRun(dataset)
    const iemRequest =
      layer === 'hrrr-refl' ? fetchIemRun() : Promise.resolve(undefined)

    // Layers with totals like precipitation start one hour in (there's
    // nothing at F00 yet). ?hour=N picks another start.
    const firstIndex = firstHourIndex(layer)
    const hourParam = new URLSearchParams(window.location.search).get('hour')
    let hourIndex = hourParam ? Number(hourParam) : firstIndex

    // Create the map once, when the component first appears.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES.light,
      bounds: CONUS_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      // Keep the map flat and north-up, like other model viewers.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()

    // "style.load" fires as soon as the basemap style is read, before its
    // tiles arrive, so the weather download starts in parallel with them.
    map.once('style.load', () => {
      // The first label layer in the basemap. Everything we add goes
      // underneath it, so city names stay on top of the weather colors.
      const firstLabelId = map
        .getStyle()
        .layers.find((l) => l.type === 'symbol')?.id

      // State and national borders, below the labels
      map.addSource('state-lines', { type: 'geojson', data: stateLines })
      map.addSource('nation-outline', { type: 'geojson', data: nationOutline })
      map.addLayer(
        {
          id: 'state-lines',
          type: 'line',
          source: 'state-lines',
          paint: { 'line-color': '#5f6b78', 'line-width': 0.8 },
        },
        firstLabelId,
      )
      map.addLayer(
        {
          id: 'nation-outline',
          type: 'line',
          source: 'nation-outline',
          paint: { 'line-color': '#4a5561', 'line-width': 1.2 },
        },
        firstLabelId,
      )

      // Weather data, underneath the borders.
      Promise.all([runRequest, iemRequest])
        .then(([run, iemRun]) => {
          if (removed) return
          hourIndex = Math.min(
            Math.max(hourIndex, firstIndex),
            run.validTimes.length - 1,
          )
          addSpikeLayer(
            map,
            layer,
            run,
            run.validTimes[hourIndex],
            'state-lines',
            iemRun,
          )
          setStatus((s) => ({ ...s, run, iemRun, hourIndex }))

          // Spike note: time from page load until the weather first draws.
          map.once('idle', () => {
            if (!removed) {
              setStatus((s) => ({ ...s, firstFrame: performance.now() }))
            }
          })

          // Step buttons: move one forecast hour and time how long it takes.
          stepRef.current = (delta) => {
            const next = hourIndex + delta
            if (next < firstIndex || next >= run.validTimes.length) return
            hourIndex = next
            const started = performance.now()
            updateSpikeLayer(map, layer, run, run.validTimes[next], iemRun)
            // A new hour starts with a clean slate: clear any earlier error.
            setStatus((s) => ({
              ...s,
              hourIndex: next,
              stepLoad: undefined,
              error: undefined,
            }))
            map.once('idle', () => {
              if (!removed) {
                setStatus((s) => ({
                  ...s,
                  stepLoad: performance.now() - started,
                }))
              }
            })
          }
        })
        .catch(fail)
    })

    map.on('error', (event) => fail(event.error ?? new Error('unknown')))

    // Clean up the map if the component is removed.
    return () => {
      removed = true
      map.remove()
    }
  }, [layer, dataset])

  return (
    <>
      <div ref={containerRef} className="map" />
      <div className="spike-info">
        <SpikeNotes label={label} status={status} />
        <div className="spike-steps">
          <button type="button" onClick={() => stepRef.current(-1)}>
            ◀ Hour
          </button>
          <button type="button" onClick={() => stepRef.current(1)}>
            Hour ▶
          </button>
        </div>
      </div>
    </>
  )
}

function SpikeNotes({ label, status }: { label: string; status: SpikeStatus }) {
  const { run, iemRun, hourIndex, firstFrame, stepLoad, error } = status
  if (error) return <div>Error: {error}</div>
  if (!run) return <div>Loading…</div>

  const validTime = run.validTimes[hourIndex]
  const lines = [
    label,
    `Open-Meteo ${runName(run.referenceTime)} F${pad(forecastHour(run, validTime))} · valid ${localTime(validTime)}`,
  ]
  if (iemRun) {
    const minute = iemMinute(iemRun, validTime)
    const iemHour =
      minute >= 0 && minute <= IEM_LAST_MINUTE
        ? `F${pad(minute / 60)}`
        : 'no tile (past F18)'
    const sameRun =
      iemRun.runTime.getTime() === run.referenceTime.getTime()
        ? 'same run'
        : 'different run'
    lines.push(`IEM ${runName(iemRun.runTime)} ${iemHour} · ${sameRun}`)
  }
  const timing = [
    firstFrame ? `first frame ${seconds(firstFrame)}` : 'loading…',
    stepLoad ? `last step ${seconds(stepLoad)}` : null,
    `isolated: ${window.crossOriginIsolated ? 'yes' : 'no'}`,
  ]
  lines.push(timing.filter(Boolean).join(' · '))
  return (
    <>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </>
  )
}
