import { useState } from 'react'
import { Check, ChevronDown, ChevronRight } from 'lucide-react'
import {
  GROUPS,
  MODELS,
  PRODUCTS,
  isAvailable,
  product,
  type Group,
  type ModelId,
  type ProductDef,
  type ProductId,
} from '../../data/catalog'
import type { RunInfo } from '../../data/openmeteo/runs'
import { runName } from '../../lib/time'
import { Sheet } from '../../ui/Sheet'

interface Props {
  model: ModelId
  productId: ProductId
  run?: RunInfo
  recent: ProductId[]
  onPick: (productId: ProductId) => void
  onClose: () => void
}

const ALL = Object.keys(PRODUCTS) as ProductId[]

// Why a product can't be picked for this model ("HRRR only", "Not in
// HRRR"), or undefined if it can.
function unavailableNote(p: ProductDef, model: ModelId): string | undefined {
  if (p.needsSum) return 'Coming later'
  if (p.models && !p.models.includes(model)) {
    return p.models.length === 1
      ? `${MODELS[p.models[0]].label} only`
      : `Not in ${MODELS[model].label}`
  }
  return undefined
}

// The product picker sheet (04), opened from the product menu: a Recent
// row, then the College of DuPage groups with the current group open.
// Picking a product closes the sheet.
export function ProductPickerSheet({
  model,
  productId,
  run,
  recent,
  onPick,
  onClose,
}: Props) {
  const [open, setOpen] = useState<Group | undefined>(product(productId).group)
  // Groups with nothing in the catalog yet (700mb) are left out until the
  // additional products are added (code plan piece 2).
  const groups = GROUPS.filter((g) => ALL.some((id) => product(id).group === g))
  const recentShown = recent.filter((id) => isAvailable(id, model))

  return (
    <Sheet
      title="Products"
      aside={
        run && (
          <span className="sheet-aside t-caption">
            {MODELS[model].label} {runName(run.referenceTime)}
          </span>
        )
      }
      onClose={onClose}
    >
      {recentShown.length > 0 && (
        <>
          <h3 className="sheet-section t-caption-strong" id="recent-label">
            RECENT
          </h3>
          <div
            className="chips"
            role="radiogroup"
            aria-labelledby="recent-label"
          >
            {recentShown.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === productId}
                aria-label={product(id).label}
                className={`chip t-callout${id === productId ? ' selected' : ''}`}
                onClick={() => onPick(id)}
              >
                {product(id).shortLabel}
              </button>
            ))}
          </div>
          <hr className="sheet-divider" />
        </>
      )}

      <div className="accordion">
        {groups.map((group) => {
          const expanded = open === group
          const items = ALL.filter((id) => product(id).group === group)
          return (
            <div key={group} className="accordion-group">
              <button
                type="button"
                className="accordion-header t-body-strong"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? undefined : group)}
              >
                {group}
                {expanded ? (
                  <ChevronDown size={16} strokeWidth={2} aria-hidden />
                ) : (
                  <ChevronRight size={16} strokeWidth={2} aria-hidden />
                )}
              </button>
              {expanded && (
                <div
                  className="product-rows"
                  role="radiogroup"
                  aria-label={group}
                >
                  {items.map((id) => {
                    const p = product(id)
                    const note = unavailableNote(p, model)
                    const selected = id === productId
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-disabled={note !== undefined}
                        aria-label={note ? `${p.label}, ${note}` : p.label}
                        className={`product-row${selected ? ' selected' : ''}`}
                        onClick={() => note === undefined && onPick(id)}
                      >
                        <span className={selected ? 't-body-strong' : 't-body'}>
                          {p.label}
                        </span>
                        {note && (
                          <span className="product-row-note t-caption">
                            {note}
                          </span>
                        )}
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
              )}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
