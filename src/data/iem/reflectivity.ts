// HRRR simulated reflectivity tiles from the Iowa Environmental Mesonet (IEM).
// Open-Meteo doesn't have reflectivity, so this is the v1 source (HRRR only).
const IEM = 'https://mesonet.agron.iastate.edu'

// IEM makes tiles every 15 minutes out to forecast hour 18 (minute 1080),
// even on HRRR runs that go to 48 hours.
export const IEM_LAST_MINUTE = 1080

export interface IemRun {
  runTime: Date // the HRRR run IEM's newest tiles come from
}

let runRequest: Promise<IemRun> | undefined

// IEM's run info file says which HRRR run its tiles are from.
export function fetchIemRun(): Promise<IemRun> {
  if (runRequest) return runRequest
  runRequest = fetch(`${IEM}/data/gis/images/4326/hrrr/refd_1080.json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`IEM run lookup failed (${response.status})`)
      }
      return response.json() as Promise<{ model_init_utc: string }>
    })
    .then((json) => ({ runTime: new Date(json.model_init_utc) }))
  // Forget a failed lookup so the next try starts fresh.
  runRequest.catch(() => (runRequest = undefined))
  return runRequest
}

// Minutes from the IEM run to a valid time, rounded to IEM's 15-minute steps.
export function iemMinute(run: IemRun, validTime: Date): number {
  const minutes = (validTime.getTime() - run.runTime.getTime()) / 60_000
  return Math.round(minutes / 15) * 15
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

// Tile address template for one valid time, or null when IEM has no tile
// for it (before the run started or past F18).
export function reflectivityTiles(run: IemRun, validTime: Date): string | null {
  const minute = iemMinute(run, validTime)
  if (minute < 0 || minute > IEM_LAST_MINUTE) return null
  const r = run.runTime
  const stamp = `${r.getUTCFullYear()}${pad(r.getUTCMonth() + 1)}${pad(r.getUTCDate())}${pad(r.getUTCHours())}${pad(r.getUTCMinutes())}`
  return `${IEM}/cache/tile.py/1.0.0/hrrr::REFD-F${pad(minute, 4)}-${stamp}/{z}/{x}/{y}.png`
}
