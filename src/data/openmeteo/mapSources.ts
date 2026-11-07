import {
  deltaTimeHoursAt,
  variableUsesDeltaTime,
} from '@openmeteo/weather-map-layer'
import type { RunInfo } from './runs'

// Open-Meteo's public bucket of map files.
export const DATA_ROOT = 'https://openmeteo.s3.amazonaws.com/data_spatial'

// Map dataset IDs from the Week 2 data check.
export type Dataset =
  | 'ncep_hrrr_conus' // HRRR, surface and upper air
  | 'ncep_gfs013' // GFS surface
  | 'ncep_gfs025' // GFS upper air, MSLP and CAPE
  | 'ecmwf_ifs' // ECMWF surface (9 km)
  | 'ecmwf_ifs025' // ECMWF upper air (0.25°)

// Extra options the map layer reads from the address, e.g.
// { contours: 'true', intervals: '60' }
type OmOptions = Record<string, string>

const pad = (n: number) => String(n).padStart(2, '0')

// The exact file for one run and one valid time, e.g.
// .../ncep_hrrr_conus/2026/11/07/1300Z/2026-11-07T1500.om
// The folder is the run time; the file name is the valid time.
export function omFileUrl(
  run: RunInfo,
  validTime: Date,
  variable: string,
  options: OmOptions = {},
): string {
  const r = run.referenceTime
  const v = validTime
  const folder = `${r.getUTCFullYear()}/${pad(r.getUTCMonth() + 1)}/${pad(r.getUTCDate())}/${pad(r.getUTCHours())}00Z`
  const file = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}T${pad(v.getUTCHours())}00.om`

  const params = new URLSearchParams({ variable, ...options })
  // Precipitation-type fields are stored as totals per time step; the map
  // layer needs the step length (in hours) to show them per hour.
  if (variableUsesDeltaTime(variable)) {
    const hours = deltaTimeHoursAt(validTime, run.validTimes)
    if (hours) params.set('delta_time_hours', String(hours))
  }
  return `om://${DATA_ROOT}/${run.dataset}/${folder}/${file}?${params.toString()}`
}

// Shortcut that lets the map layer look up the newest run itself.
// Slower (an extra lookup per layer), so the app uses omFileUrl instead.
export function omLatestUrl(
  dataset: Dataset,
  variable: string,
  options: OmOptions = {},
): string {
  const params = new URLSearchParams({ variable, ...options })
  return `om://${DATA_ROOT}/${dataset}/latest.json?${params.toString()}`
}
