import { useEffect, useState } from 'react'
import {
  DEFAULT_PRODUCT,
  MODELS,
  type ModelId,
  type ProductId,
} from './catalog'
import { loadProductRuns, type ProductRuns } from './useProductRuns'

export type ModelRuns = Partial<Record<ModelId, ProductRuns | Error>>

const MODEL_IDS = Object.keys(MODELS) as ModelId[]

// The latest run of every model, for the model menu and the model switch
// sheet. Each model is looked up for `productId` if it has it, and for SLP
// and precip if not (a model without the product still shows its run).
// Lookups are shared with the map, so opening the sheet is usually instant.
export function useModelRuns(
  productId: ProductId,
  has: (model: ModelId) => boolean,
): ModelRuns {
  const [runs, setRuns] = useState<{ key: string; runs: ModelRuns }>({
    key: '',
    runs: {},
  })
  const plan = MODEL_IDS.map(
    (m) => [m, has(m) ? productId : DEFAULT_PRODUCT] as const,
  )
  const key = plan.map((p) => p.join(':')).join(',')

  useEffect(() => {
    let current = true
    for (const [model, product] of plan) {
      loadProductRuns(model, product).then(
        (data) =>
          current &&
          setRuns((s) => ({
            key,
            runs: { ...(s.key === key ? s.runs : {}), [model]: data },
          })),
        (error: Error) =>
          current &&
          setRuns((s) => ({
            key,
            runs: { ...(s.key === key ? s.runs : {}), [model]: error },
          })),
      )
    }
    return () => {
      current = false
    }
    // `plan` is derived from `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return runs.key === key ? runs.runs : {}
}
