import { Check } from 'lucide-react'
import {
  MODELS,
  isAvailable,
  product,
  type ModelId,
  type ProductId,
} from '../../data/catalog'
import { useModelRuns } from '../../data/useModelRuns'
import {
  ageLabel,
  hourLabel,
  hourRange,
  hoursBetween,
  runName,
  shortValid,
  snapIndex,
  spokenAge,
  spokenValid,
} from '../../lib/time'
import { firstHourIndex } from '../../map/productLayers'
import { Sheet } from '../../ui/Sheet'

interface Props {
  model: ModelId
  productId: ProductId
  validTime?: Date // the valid time on the map
  onPick: (model: ModelId) => void
  onClose: () => void
}

const ORDER: ModelId[] = ['hrrr', 'gfs', 'ecmwf']

// "Mon 4 AM": a valid time without the zone, for the row details.
const dayHour = (t: Date) => shortValid(t).replace(/ [A-Z]{2,5}$/, '')

// The model switch sheet (03), opened from the run label. The valid time
// is kept (Week 3): each row says which forecast hour that is in its run,
// or where its run ends. Models without the current product are marked,
// and picking one falls back to SLP and precip (S3).
export function ModelSwitchSheet({
  model,
  productId,
  validTime,
  onPick,
  onClose,
}: Props) {
  const p = product(productId)
  const runs = useModelRuns(productId, (m) => isAvailable(productId, m))

  return (
    <Sheet
      title="Switch model"
      subtitle={
        validTime ? `Keeps the valid time: ${shortValid(validTime)}` : undefined
      }
      onClose={onClose}
    >
      <div className="model-rows" role="radiogroup" aria-label="Model">
        {ORDER.map((id) => {
          const data = runs[id]
          const has =
            isAvailable(productId, id) &&
            !(data && !(data instanceof Error) && !data.available)
          const run = data && !(data instanceof Error) ? data.main : undefined
          const parts: string[] = []
          const spoken: string[] = [MODELS[id].label]
          if (run) {
            parts.push(runName(run.referenceTime), ageLabel(run.referenceTime))
            spoken.push(
              `run ${runName(run.referenceTime)}`,
              spokenAge(run.referenceTime),
            )
            if (!run.completed) {
              parts.push('coming in')
              spoken.push('still coming in')
            }
            if (validTime && has) {
              const range = hourRange(
                run.validTimes,
                firstHourIndex(productId),
                p.maxForecastHour,
              )
              const t = validTime.getTime()
              const lastTime = range.times[range.last]
              const firstTime = range.times[range.first]
              if (t > lastTime.getTime()) {
                parts.push(`ends ${dayHour(lastTime)}`)
                spoken.push(`ends ${spokenValid(lastTime)}`)
              } else if (t < firstTime.getTime()) {
                parts.push(`starts ${dayHour(firstTime)}`)
                spoken.push(`starts ${spokenValid(firstTime)}`)
              } else {
                const i = snapIndex(range, t)
                const fh = hoursBetween(range.times[0], range.times[i])
                parts.push(hourLabel(fh))
                spoken.push(`forecast hour ${fh}`)
              }
            }
          } else {
            parts.push(data instanceof Error ? 'Couldn’t load' : 'Loading…')
          }
          if (!has) {
            const missing = `No ${p.shortLabel.toLowerCase()}`
            parts.push(missing)
            spoken.push(`${missing}, shows SLP and precipitation`)
          }
          const selected = id === model
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={spoken.join(', ')}
              className={`model-row${selected ? ' selected' : ''}`}
              onClick={() => (selected ? onClose() : onPick(id))}
            >
              <span className="model-row-text">
                <span className="t-headline">{MODELS[id].label}</span>
                <span className="model-row-detail t-caption">
                  {parts.join(' · ')}
                </span>
              </span>
              {selected && (
                <Check
                  className="row-check"
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>
      <p className="sheet-hint t-caption">
        Models without the current product are marked (e.g. “No reflectivity”);
        picking one falls back to SLP and precip.
      </p>
    </Sheet>
  )
}
