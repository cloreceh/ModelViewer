import { ChevronDown, SkipBack, SkipForward } from 'lucide-react'
import { MODELS, product, type ModelId, type ProductId } from '../data/catalog'
import type { RunInfo } from '../data/openmeteo/runs'
import {
  hourLabel,
  hoursBetween,
  runName,
  shortValid,
  spokenValid,
  stepSize,
  type HourRange,
} from '../lib/time'
import { TimeSlider } from './TimeSlider'

interface Props {
  model: ModelId
  productId: ProductId
  run?: RunInfo // undefined while the run loads
  range?: HourRange
  index?: number
  previewIndex?: number // while dragging the slider
  onPreview: (index: number | undefined) => void
  onChangeHour: (index: number, how: 'step' | 'drag' | 'key') => void
  onOpenModels: () => void
  onOpenProducts: () => void
}

// The bottom panel (Week 5, layout C): run label and product menus, two
// step buttons, and the slider.
export function BottomPanel({
  model,
  productId,
  run,
  range,
  index,
  previewIndex,
  onPreview,
  onChangeHour,
  onOpenModels,
  onOpenProducts,
}: Props) {
  const p = product(productId)
  const shown = previewIndex ?? index
  const ready = run && range && index !== undefined && shown !== undefined
  const validTime = ready ? range.times[shown] : undefined
  const fh = ready ? hoursBetween(range.times[0], range.times[shown]) : 0
  const modelName = MODELS[model].label

  const back = ready ? stepSize(range, index, -1) : undefined
  const forward = ready ? stepSize(range, index, 1) : undefined
  const step = (direction: -1 | 1) => {
    if (!ready) return
    if (stepSize(range, index, direction) === undefined) return
    onChangeHour(index + direction, 'step')
  }

  const hoursWord = (h: number) => (h === 1 ? '1 hour' : `${h} hours`)

  return (
    <div className="bottom-panel">
      <div className="panel-menus">
        <button
          type="button"
          className="run-label"
          aria-haspopup="dialog"
          aria-label={
            ready
              ? `Model ${modelName}, run ${runName(run.referenceTime)}. Valid ${spokenValid(validTime!)}, forecast hour ${fh}. Switch model`
              : `Model ${modelName}, loading. Switch model`
          }
          onClick={onOpenModels}
        >
          <span className="run-line">
            <span className="t-headline">
              {modelName} {ready ? runName(run.referenceTime) : ''}
            </span>
            <ChevronDown size={16} strokeWidth={2} aria-hidden />
          </span>
          <span className="run-valid t-caption">
            {ready
              ? `Valid ${shortValid(validTime!)} · ${hourLabel(fh)}`
              : 'Loading the latest run…'}
          </span>
        </button>
        <button
          type="button"
          className="product-menu"
          aria-haspopup="dialog"
          aria-label={`Product: ${p.label}. Change product`}
          onClick={onOpenProducts}
        >
          <span className="t-body-strong">{p.shortLabel}</span>
          <ChevronDown size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="step-buttons">
        <button
          type="button"
          className="step-button"
          aria-disabled={back === undefined}
          aria-label={back ? `Back ${hoursWord(back)}` : 'Back (first hour)'}
          onClick={() => step(-1)}
        >
          <SkipBack size={22} strokeWidth={2} aria-hidden />
          <span className="t-body-strong" aria-hidden>
            {`−${back ?? 1} h`}
          </span>
        </button>
        <button
          type="button"
          className="step-button"
          aria-disabled={forward === undefined}
          aria-label={
            forward ? `Forward ${hoursWord(forward)}` : 'Forward (last hour)'
          }
          onClick={() => step(1)}
        >
          <span className="t-body-strong" aria-hidden>
            {`+${forward ?? 1} h`}
          </span>
          <SkipForward size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {ready ? (
        <TimeSlider
          range={range}
          index={index}
          afterLastNote={
            p.maxForecastHour !== undefined
              ? `No ${p.shortLabel.toLowerCase()} after ${hourLabel(p.maxForecastHour)}`
              : undefined
          }
          onPreview={onPreview}
          onChange={(i, how) => onChangeHour(i, how)}
        />
      ) : (
        <div className="slider slider-loading" aria-hidden>
          <div className="slider-row">
            <span className="slider-track" />
          </div>
        </div>
      )}
    </div>
  )
}
