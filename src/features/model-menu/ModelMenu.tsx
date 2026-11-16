import { useEffect, useRef } from 'react'
import { MODELS, type ModelId } from '../../data/catalog'
import { useModelRuns } from '../../data/useModelRuns'
import { ageLabel, runName, spokenAge } from '../../lib/time'
import { useAppStore } from '../../state/store'

// What each card says under the model name (screen 01).
const DESCRIPTION: Record<ModelId, { text: string; spoken: string }> = {
  hrrr: {
    text: '3 km · runs every hour · 18 h (48 h at 00, 06, 12, 18Z)',
    spoken: '3 kilometers, runs every hour',
  },
  gfs: {
    text: '0.25° / 0.13° · runs every 6 hours · 16 days',
    spoken: '0.25 and 0.13 degrees, runs every 6 hours',
  },
  ecmwf: {
    text: 'IFS 9 km / 0.25° · runs every 6 hours · 15 days',
    spoken: 'IFS, 9 kilometers and 0.25 degrees, runs every 6 hours',
  },
}

const ORDER: ModelId[] = ['hrrr', 'gfs', 'ecmwf']

// The model menu (01): opens on launch unless the address names a view.
// Picking a model opens the map on SLP and precip at F00.
export function ModelMenu() {
  const openModel = useAppStore((s) => s.openModel)
  const runs = useModelRuns('slpPrecip', () => true)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = 'Choose a model · Model Viewer'
    headingRef.current?.focus()
  }, [])

  return (
    <main className="model-menu">
      <h1 className="t-title" ref={headingRef} tabIndex={-1}>
        Choose a model
      </h1>
      <p className="model-menu-sub t-callout">Latest runs · CONUS</p>
      <div className="model-cards">
        {ORDER.map((id) => {
          const data = runs[id]
          const run = data && !(data instanceof Error) ? data.main : undefined
          const comingIn = run && !run.completed
          const latest = run
            ? `Latest run: ${runName(run.referenceTime)} · ${ageLabel(run.referenceTime)}`
            : data instanceof Error
              ? 'Latest run: couldn’t load'
              : 'Latest run: loading…'
          const spoken = [
            MODELS[id].label,
            DESCRIPTION[id].spoken,
            run
              ? `Latest run ${runName(run.referenceTime)}, ${spokenAge(run.referenceTime)}`
              : 'Latest run loading',
            comingIn ? 'Still coming in' : run ? 'Complete' : '',
          ]
            .filter(Boolean)
            .join('. ')
          return (
            <button
              key={id}
              type="button"
              className="model-card"
              aria-label={spoken}
              onClick={() => openModel(id)}
            >
              <span className="model-card-title">
                <span className="t-heading">{MODELS[id].label}</span>
                {run && (
                  <span
                    className={`status-chip t-caption-strong${comingIn ? ' status-chip-coming' : ''}`}
                  >
                    {comingIn ? 'Coming in' : 'Complete'}
                  </span>
                )}
              </span>
              <span className="model-card-detail t-caption">
                {DESCRIPTION[id].text}
              </span>
              <span className="t-callout">{latest}</span>
            </button>
          )
        })}
      </div>
      {/* The tip about saving a start view comes with the start view
          (Week 11). */}
    </main>
  )
}
