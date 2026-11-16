import { useEffect, useState } from 'react'
import {
  MODELS,
  datasetFor,
  isAvailable,
  product,
  productDatasets,
  productVariables,
  type ModelId,
  type ProductId,
} from './catalog'
import { fetchLatestRun, type RunInfo } from './openmeteo/runs'
import type { Dataset } from './openmeteo/mapSources'
import { fetchIemRun, type IemRun } from './iem/reflectivity'

// Everything the map and time controls need about the runs behind one
// model and product: each dataset's latest run, the run that sets the
// forecast hours, and IEM's run for reflectivity.
export interface ProductRuns {
  model: ModelId
  productId: ProductId
  runs: Partial<Record<Dataset, RunInfo>>
  main: RunInfo
  iemRun?: IemRun
  available: boolean // false if this run lacks one of the product's fields
}

// The dataset whose run sets the forecast hours (the product's first layer;
// reflectivity follows HRRR's surface run).
export function mainDataset(model: ModelId, productId: ProductId): Dataset {
  const first = productVariables(productId)[0]
  return first ? datasetFor(model, first) : MODELS[model].surfaceDataset
}

export function loadProductRuns(
  model: ModelId,
  productId: ProductId,
): Promise<ProductRuns> {
  const datasets = productDatasets(productId, model)
  const main = mainDataset(model, productId)
  if (!datasets.includes(main)) datasets.push(main)
  const usesIem = product(productId).layers.some(
    (l) => l.kind === 'iem-reflectivity',
  )
  return Promise.all([
    Promise.all(datasets.map((d) => fetchLatestRun(d))),
    usesIem ? fetchIemRun() : Promise.resolve(undefined),
  ]).then(([list, iemRun]) => {
    const runs = Object.fromEntries(list.map((r) => [r.dataset, r]))
    const variables = Object.fromEntries(
      list.map((r) => [r.dataset, r.variables]),
    )
    return {
      model,
      productId,
      runs,
      main: runs[main]!,
      iemRun,
      available: isAvailable(productId, model, variables),
    }
  })
}

// Loads the runs for the current model and product. While a new pair
// loads, `data` is undefined (the run lookups are cached, so switching back
// is instant).
export function useProductRuns(model: ModelId, productId: ProductId) {
  const [state, setState] = useState<{
    key: string
    data?: ProductRuns
    error?: string
  }>({ key: '' })
  const key = `${model}/${productId}`
  // Bumped by "Try again" to repeat a failed lookup.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    loadProductRuns(model, productId).then(
      (data) => current && setState({ key, data }),
      (error: Error) => current && setState({ key, error: error.message }),
    )
    return () => {
      current = false
    }
  }, [key, model, productId, attempt])

  const fresh = state.key === key
  return {
    data: fresh ? state.data : undefined,
    error: fresh ? state.error : undefined,
    retry: () => setAttempt((n) => n + 1),
  }
}
