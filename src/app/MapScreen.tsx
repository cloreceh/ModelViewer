import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapLibreMap } from 'maplibre-gl'
import {
  DEFAULT_PRODUCT,
  MODELS,
  isAvailable,
  product,
  type ModelId,
  type ProductId,
} from '../data/catalog'
import { useProductRuns } from '../data/useProductRuns'
import {
  hourLabel,
  hourRange,
  hoursBetween,
  indexAtHour,
  runName,
  shortValid,
  snapIndex,
  spokenValid,
} from '../lib/time'
import { ModelSwitchSheet } from '../features/model-switch/ModelSwitchSheet'
import { ProductPickerSheet } from '../features/product-picker/ProductPickerSheet'
import { CreditsSheet } from '../map/CreditsSheet'
import { LegendSheet } from '../map/LegendSheet'
import { useToast } from '../state/toast'
import { Toast } from '../ui/Toast'
import { Legend } from '../map/Legend'
import { CreditsButton, TopButtons, ZoomButtons } from '../map/MapButtons'
import { MapView } from '../map/MapView'
import { firstHourIndex } from '../map/productLayers'
import { OPENING_VIEW } from '../map/basemap'
import { useAppStore } from '../state/store'
import { useTheme } from '../state/theme'
import { BottomPanel } from '../time/BottomPanel'

const APP_NAME = 'Model Viewer'

// Search and Settings open their screens in Week 10. Kept as named stubs
// so the buttons are in place for focus order and layout.
const notYet = () => {}

type SheetName = 'models' | 'products' | 'legend' | 'credits'

// The view before a model or product switch, for Undo and for working out
// whether the kept valid time had to move.
interface Switch {
  key: string // model/product being switched to
  before: { model: ModelId; productId: ProductId; validTime?: number }
  toasted: boolean
}

// The map screen (02): the map, the buttons on it, the floating legend and
// the bottom panel.
export function MapScreen() {
  const model = useAppStore((s) => s.model)
  const productId = useAppStore((s) => s.productId)
  const validTime = useAppStore((s) => s.validTime)
  const requestedHour = useAppStore((s) => s.requestedHour)
  const units = useAppStore((s) => s.units)
  const legendLabels = useAppStore((s) => s.legendLabels)
  const setModel = useAppStore((s) => s.setModel)
  const setProduct = useAppStore((s) => s.setProduct)
  const setValidTime = useAppStore((s) => s.setValidTime)
  const restore = useAppStore((s) => s.restore)
  const recentProducts = useAppStore((s) => s.recentProducts)
  const showToast = useToast((s) => s.show)
  const toggleLegendLabels = useAppStore((s) => s.toggleLegendLabels)
  const theme = useTheme()

  const { data, error: runError } = useProductRuns(model, productId)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [mapError, setMapError] = useState<string>()
  const [preview, setPreview] = useState<number>()
  const [announcement, setAnnouncement] = useState('')
  const [sheet, setSheet] = useState<SheetName>()
  const switchRef = useRef<Switch | null>(null)

  const p = product(productId)
  const undo = (before: Switch['before']) => ({
    label: 'Undo',
    run: () => restore(before),
  })

  // A run that lacks one of the product's fields falls back to SLP and
  // precipitation, with Undo (S3).
  useEffect(() => {
    if (!data || data.available || productId === DEFAULT_PRODUCT) return
    const pending = switchRef.current
    setProduct(DEFAULT_PRODUCT)
    if (pending) {
      showToast(
        `${MODELS[model].label} ${runName(data.main.referenceTime)} has no ${product(productId).shortLabel.toLowerCase()}. Showing SLP and precip.`,
        undo(pending.before),
      )
      switchRef.current = {
        ...pending,
        key: `${model}/${DEFAULT_PRODUCT}`,
        toasted: true,
      }
    }
    // undo() only reads its argument
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, productId, model, setProduct, showToast])

  const range = useMemo(
    () =>
      data
        ? hourRange(
            data.main.validTimes,
            firstHourIndex(productId),
            p.maxForecastHour,
          )
        : undefined,
    [data, productId, p.maxForecastHour],
  )
  // The hour on screen: the one asked for in the address, else the kept
  // valid time snapped to an hour this model and product have, else F00.
  const index = range
    ? requestedHour !== undefined
      ? indexAtHour(range, requestedHour)
      : snapIndex(range, validTime)
    : undefined
  const frameTime =
    range && index !== undefined ? range.times[index] : undefined
  const run = data?.main

  // After a switch, the kept valid time may not exist in the new run:
  // keep the hour it snapped to, and say why (Message copy panel).
  useEffect(() => {
    const pending = switchRef.current
    if (!pending || !data || !range || index === undefined) return
    if (`${data.model}/${data.productId}` !== pending.key) return
    switchRef.current = null
    const wanted = pending.before.validTime
    const shown = range.times[index]
    if (wanted === undefined || shown.getTime() === wanted) return
    setValidTime(shown.getTime())
    if (pending.toasted) return
    const name = MODELS[data.model].label
    const runLabel = `${name} ${runName(data.main.referenceTime)}`
    const fh = hoursBetween(range.times[0], shown)
    const pp = product(data.productId)
    if (wanted > range.times[range.last].getTime()) {
      if (
        pp.maxForecastHour !== undefined &&
        range.last < range.times.length - 1
      ) {
        showToast(
          `${pp.shortLabel} ends at ${hourLabel(pp.maxForecastHour)}.`,
          {
            label: 'Change product',
            run: () => setSheet('products'),
          },
        )
      } else {
        showToast(
          `${name} ends at ${hourLabel(fh)}. Showing its last hour.`,
          undo(pending.before),
        )
      }
    } else if (wanted < range.times[range.first].getTime()) {
      showToast(
        `${runLabel} starts ${shortValid(shown)}. Showing its first hour.`,
        undo(pending.before),
      )
    } else {
      const step = Math.abs(
        hoursBetween(
          range.times[index],
          range.times[index === range.last ? index - 1 : index + 1],
        ),
      )
      const upper =
        data.main.dataset === MODELS[data.model].upperDataset &&
        MODELS[data.model].upperDataset !== MODELS[data.model].surfaceDataset
      showToast(
        upper
          ? `${name} upper air is every ${step} hours. Moved to ${hourLabel(fh)}.`
          : `${name} is every ${step} hours at this range. Moved to ${hourLabel(fh)}.`,
      )
    }
    // undo() only reads its argument
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range, index, setValidTime, showToast])

  // Switching keeps the valid time on screen (Week 3).
  const pickModel = (next: ModelId) => {
    setSheet(undefined)
    if (next === model) return
    const before = { model, productId, validTime: frameTime?.getTime() }
    setValidTime(before.validTime)
    if (!isAvailable(productId, next)) {
      setModel(next, DEFAULT_PRODUCT)
      showToast(
        `${MODELS[next].label} has no ${p.shortLabel.toLowerCase()}. Showing SLP and precip.`,
        undo(before),
      )
      switchRef.current = {
        key: `${next}/${DEFAULT_PRODUCT}`,
        before,
        toasted: true,
      }
    } else {
      setModel(next)
      switchRef.current = {
        key: `${next}/${productId}`,
        before,
        toasted: false,
      }
    }
  }
  const pickProduct = (next: ProductId) => {
    setSheet(undefined)
    if (next === productId) return
    const before = { model, productId, validTime: frameTime?.getTime() }
    setValidTime(before.validTime)
    setProduct(next)
    switchRef.current = { key: `${model}/${next}`, before, toasted: false }
  }

  // Page title and the address follow the view (Week 8 piece 1, Week 9).
  useEffect(() => {
    if (!run || !frameTime) {
      document.title = APP_NAME
      return
    }
    const what = p.shortLabel.replace(' & ', ' and ')
    document.title = `${MODELS[model].label} ${runName(run.referenceTime)} ${what} · ${APP_NAME}`
    const q = new URLSearchParams(window.location.search)
    q.set('model', model)
    q.set('product', productId)
    q.set('hour', String(hoursBetween(run.referenceTime, frameTime)))
    const next = `${window.location.pathname}?${q.toString()}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next)
    }
  }, [model, productId, run, frameTime, p.shortLabel])

  // Leave room for the buttons at the top and the legend and bottom panel,
  // so the US sits between them (Week 8 opening view).
  const bottomRef = useRef<HTMLDivElement>(null)
  const [bottomHeight, setBottomHeight] = useState(OPENING_VIEW.padding.bottom)
  useLayoutEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const update = () => setBottomHeight(Math.round(el.offsetHeight))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const padding = useMemo(
    () => ({ top: OPENING_VIEW.padding.top, bottom: bottomHeight }),
    [bottomHeight],
  )

  const changeHour = (i: number, how: 'step' | 'drag' | 'key') => {
    if (!range) return
    const time = range.times[i]
    setValidTime(time.getTime())
    setMapError(undefined)
    // Read out the new valid time after a step (Week 7): "Monday 4 PM,
    // forecast hour 40". The slider reads its own value while dragging.
    if (how !== 'drag') {
      const when = spokenValid(time).replace(/ [A-Z]{2,5}$/, '')
      setAnnouncement(
        `${when}, forecast hour ${hoursBetween(range.times[0], time)}`,
      )
    }
  }

  const mapLabel =
    run && frameTime
      ? `Map. ${MODELS[model].label} ${runName(run.referenceTime)}, ${p.label}, valid ${spokenValid(frameTime)}`
      : 'Map'
  const error = runError ?? mapError

  return (
    <div className="map-screen">
      {/* While a sheet is open, the map and its controls are hidden from
          screen readers and can't take focus (Week 7). */}
      <div className="map-layer" inert={sheet !== undefined}>
        {/* Status messages are first in the reading order (Week 7). */}
        <div className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </div>

        <TopButtons onSearch={notYet} onSettings={notYet} />

        <MapView
          theme={theme}
          units={units}
          runs={data}
          frameTime={frameTime}
          padding={padding}
          label={mapLabel}
          onMap={setMap}
          onError={setMapError}
        />

        {error && (
          <div className="error-card" role="alert">
            <span className="t-body-strong">Couldn't load this hour</span>
            <span className="t-caption">{error}</span>
          </div>
        )}

        <div className="bottom-stack" ref={bottomRef}>
          <Toast />
          <div className="map-controls-row">
            <CreditsButton onOpen={() => setSheet('credits')} />
            <ZoomButtons map={map} />
          </div>
          <Legend
            productId={productId}
            units={units}
            labelsShown={legendLabels}
            onToggleLabels={toggleLegendLabels}
            onOpenSheet={() => setSheet('legend')}
          />
          <BottomPanel
            model={model}
            productId={productId}
            run={run}
            range={range}
            index={index}
            previewIndex={preview}
            onPreview={setPreview}
            onChangeHour={changeHour}
            onOpenModels={() => setSheet('models')}
            onOpenProducts={() => setSheet('products')}
          />
        </div>
      </div>

      {sheet === 'models' && (
        <ModelSwitchSheet
          model={model}
          productId={productId}
          validTime={frameTime}
          onPick={pickModel}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === 'products' && (
        <ProductPickerSheet
          model={model}
          productId={productId}
          run={run}
          recent={recentProducts}
          onPick={pickProduct}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === 'legend' && (
        <LegendSheet
          productId={productId}
          units={units}
          onClose={() => setSheet(undefined)}
        />
      )}
      {sheet === 'credits' && (
        <CreditsSheet
          productId={productId}
          onClose={() => setSheet(undefined)}
        />
      )}
    </div>
  )
}
