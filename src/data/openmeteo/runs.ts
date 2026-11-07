import { DATA_ROOT, type Dataset } from './mapSources'

// What latest.json says about a dataset's newest run.
export interface RunInfo {
  dataset: Dataset
  referenceTime: Date // when the run started (e.g. 13Z)
  validTimes: Date[] // every forecast hour in the run
  variables: string[] // fields this dataset has
  completed: boolean // false while the run is still coming in
}

interface LatestJson {
  completed: boolean
  reference_time: string
  valid_times: string[]
  variables: string[]
}

// One lookup per dataset, shared by everything that asks for it.
const runCache = new Map<Dataset, Promise<RunInfo>>()

export function fetchLatestRun(dataset: Dataset): Promise<RunInfo> {
  const cached = runCache.get(dataset)
  if (cached) return cached

  const request = fetch(`${DATA_ROOT}/${dataset}/latest.json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Run lookup failed for ${dataset} (${response.status})`)
      }
      return response.json() as Promise<LatestJson>
    })
    .then((json) => ({
      dataset,
      referenceTime: new Date(json.reference_time),
      validTimes: json.valid_times.map((t) => new Date(t)),
      variables: json.variables,
      completed: json.completed,
    }))

  // Forget a failed lookup so the next try starts fresh.
  request.catch(() => runCache.delete(dataset))
  runCache.set(dataset, request)
  return request
}

// Forecast hour of a valid time in a run, e.g. 13Z run at 15Z = 2.
export function forecastHour(run: RunInfo, validTime: Date): number {
  return Math.round(
    (validTime.getTime() - run.referenceTime.getTime()) / 3_600_000,
  )
}
