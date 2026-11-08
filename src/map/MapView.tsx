import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre draws map data in a background worker. Point it at the worker
// file explicitly so Vite includes it in both dev and production builds.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { BASEMAP_STYLES, CONUS_BOUNDS, tuneBasemap } from './basemap'
import { nationOutline, stateLines } from './boundaries'
import { registerOmProtocol } from './omProtocol'
import {
  addProductLayers,
  firstHourIndex,
  updateProductLayers,
  type ProductContext,
  type Theme,
} from './productLayers'
import {
  DEFAULT_PRODUCT,
  MODELS,
  isAvailable,
  isModelId,
  isProductId,
  product,
  productDatasets,
  productVariables,
  datasetFor,
  type ModelId,
  type ProductId,
} from '../data/catalog'
import {
  fetchLatestRun,
  forecastHour,
  type RunInfo,
} from '../data/openmeteo/runs'
import type { Dataset } from '../data/openmeteo/mapSources'
import { fetchIemRun, type IemRun } from '../data/iem/reflectivity'
import {
  UNIT_PRESETS,
  displayUnit,
  type UnitPreset,
  type UnitSettings,
} from '../lib/units'

maplibregl.setWorkerUrl(workerUrl)

// Until the pickers and settings exist (Week 9), the address picks what to
// show: ?model=gfs&product=heights500&units=metric&theme=dark&hour=6
// (hour is the forecast hour; the nearest one at or after it is shown)
function readParams() {
  const q = new URLSearchParams(window.location.search)
  const model: ModelId = isModelId(q.get('model'))
    ? (q.get('model') as ModelId)
    : 'hrrr'
  const asked = q.get('product')
  const wanted: ProductId = isProductId(asked) ? asked : DEFAULT_PRODUCT
  // Products a model can't show fall back to the default (SLP and precip).
  const productId = isAvailable(wanted, model) ? wanted : DEFAULT_PRODUCT
  const preset = (q.get('units') ?? 'default') as UnitPreset
  const units: UnitSettings = UNIT_PRESETS[preset] ?? UNIT_PRESETS.default
  const theme: Theme = q.get('theme') === 'dark' ? 'dark' : 'light'
  const hour = q.get('hour')
  return {
    model,
    productId,
    fellBack: productId !== wanted ? wanted : undefined,
    units,
    theme,
    hour: hour ? Number(hour) : undefined,
    debug: q.has('debug'),
  }
}

const params = readParams()
registerOmProtocol(params.units)

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const pad = (n: number) => String(n).padStart(2, '0')
const runName = (time: Date) => `${pad(time.getUTCHours())}Z`
const localTime = (time: Date) =>
  time.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    timeZoneName: 'short',
  })

// What the temporary notes line shows (removed once the run label exists).
interface Status {
  run?: RunInfo
  hourIndex: number
  firstFrame?: number
  stepLoad?: number
  error?: string
}

// The dataset whose run sets the forecast hours (the product's first layer;
// reflectivity follows HRRR's surface run).
function mainDataset(model: ModelId, productId: ProductId): Dataset {
  const first = productVariables(productId)[0]
  return first ? datasetFor(model, first) : MODELS[model].surfaceDataset
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  // Lets the step buttons reach the map and its layers.
  const stepRef = useRef<(delta: number) => void>(() => {})
  const [status, setStatus] = useState<Status>({ hourIndex: 0 })
  const { model, productId, units, theme } = params

  useEffect(() => {
    if (!containerRef.current) return
    let removed = false
    const fail = (error: { message: string }) =>
      !removed && setStatus((s) => ({ ...s, error: error.message }))

    // Start the run lookups right away, at the same time as the basemap
    // loads, instead of waiting for the map to be ready.
    const datasets = productDatasets(productId, model)
    const main = mainDataset(model, productId)
    if (!datasets.includes(main)) datasets.push(main)
    const runRequests = Promise.all(datasets.map((d) => fetchLatestRun(d)))
    const usesIem = product(productId).layers.some(
      (l) => l.kind === 'iem-reflectivity',
    )
    const iemRequest: Promise<IemRun | undefined> = usesIem
      ? fetchIemRun()
      : Promise.resolve(undefined)

    const firstIndex = firstHourIndex(productId)
    let hourIndex = firstIndex

    // Create the map once, when the component first appears.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLES[theme],
      bounds: CONUS_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      // Keep the map flat and north-up, like other model viewers.
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()
    // ?debug exposes the map in the browser console (window.__map) for checks.
    if (params.debug)
      (window as unknown as { __map: maplibregl.Map }).__map = map

    // "style.load" fires as soon as the basemap style is read, before its
    // tiles arrive, so the weather download starts in parallel with them.
    map.once('style.load', () => {
      // Lighter roads and fewer labels, so the weather colors lead.
      tuneBasemap(map, theme)

      // The first label layer in the basemap. Everything we add goes
      // underneath it, so city names stay on top of the weather colors.
      const firstLabelId = map
        .getStyle()
        .layers.find((l) => l.type === 'symbol')?.id
      const border =
        theme === 'dark' ? ['#9aa5b1', '#b5bec8'] : ['#5f6b78', '#4a5561']

      // State and national borders, below the labels
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

      // Weather data, underneath the borders.
      Promise.all([runRequests, iemRequest])
        .then(([runList, iemRun]) => {
          if (removed) return
          const runs = Object.fromEntries(
            runList.map((r) => [r.dataset, r]),
          ) as ProductContext['runs']
          const run = runs[main]!
          // Reflectivity stops at F18 (IEM tiles end there).
          const maxHour = product(productId).maxForecastHour
          const lastIndex =
            maxHour === undefined
              ? run.validTimes.length - 1
              : run.validTimes.filter((t) => forecastHour(run, t) <= maxHour)
                  .length - 1
          if (params.hour !== undefined) {
            const wanted = params.hour
            const i = run.validTimes.findIndex(
              (t) => forecastHour(run, t) >= wanted,
            )
            if (i >= 0) hourIndex = i
          }
          hourIndex = Math.min(Math.max(hourIndex, firstIndex), lastIndex)
          const ctx: ProductContext = {
            model,
            product: productId,
            runs,
            iemRun,
            units,
            theme,
          }
          addProductLayers(map, ctx, run.validTimes[hourIndex], 'state-lines')
          setStatus((s) => ({ ...s, run, hourIndex }))

          // Time from page load until the weather first draws.
          map.once('idle', () => {
            if (!removed) {
              setStatus((s) => ({ ...s, firstFrame: performance.now() }))
            }
          })

          // Step buttons: move one forecast hour and time how long it takes.
          stepRef.current = (delta) => {
            const next = hourIndex + delta
            if (next < firstIndex || next > lastIndex) return
            hourIndex = next
            const started = performance.now()
            updateProductLayers(map, ctx, run.validTimes[next])
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
  }, [model, productId, units, theme])

  return (
    <>
      <div ref={containerRef} className="map" />
      <div className="spike-info">
        <Notes status={status} />
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

// Temporary notes line: what's on screen, the run and the timings.
function Notes({ status }: { status: Status }) {
  const { run, hourIndex, firstFrame, stepLoad, error } = status
  const { model, productId, units, fellBack } = params
  const p = product(productId)
  const shaded = p.layers.find((l) => l.kind === 'shaded')
  const unit = shaded ? displayUnit(shaded.quantity, p.level, units) : 'dBZ'
  const lines = [
    `${MODELS[model].label} · ${p.label} · ${unit}${p.period ? ` · ${p.period}` : ''}`,
  ]
  if (fellBack) {
    const why = product(fellBack).needsSum
      ? 'not built yet'
      : `not in ${MODELS[model].label}`
    lines.push(`${product(fellBack).label} is ${why}; showing ${p.label}`)
  }
  if (error) lines.push(`Error: ${error}`)
  else if (!run) lines.push('Loading…')
  else {
    const validTime = run.validTimes[hourIndex]
    lines.push(
      `${runName(run.referenceTime)} F${pad(forecastHour(run, validTime))} · valid ${localTime(validTime)}`,
    )
    lines.push(
      [
        firstFrame ? `first frame ${seconds(firstFrame)}` : 'loading…',
        stepLoad ? `last step ${seconds(stepLoad)}` : null,
        `isolated: ${window.crossOriginIsolated ? 'yes' : 'no'}`,
      ]
        .filter(Boolean)
        .join(' · '),
    )
  }
  return (
    <>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </>
  )
}
