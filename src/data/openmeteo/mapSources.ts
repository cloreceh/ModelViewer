// Builds om:// addresses for the Open-Meteo weather map layer.
// "latest.json" always points at the newest run of a dataset.
const DATA_ROOT = 'https://openmeteo.s3.amazonaws.com/data_spatial'

// Map dataset IDs from the Week 2 data check.
export type Dataset =
  | 'ncep_hrrr_conus' // HRRR, surface and upper air
  | 'ncep_gfs013' // GFS surface
  | 'ncep_gfs025' // GFS upper air, MSLP and CAPE
  | 'ecmwf_ifs' // ECMWF surface (9 km)
  | 'ecmwf_ifs025' // ECMWF upper air (0.25°)

// Extra options the map layer reads from the address, e.g.
// { contours: 'true', intervals: '60' } or { time_step: 'valid_times_6' }
type OmOptions = Record<string, string>

export function omUrl(
  dataset: Dataset,
  variable: string,
  options: OmOptions = {},
): string {
  const params = new URLSearchParams({ variable, ...options })
  return `om://${DATA_ROOT}/${dataset}/latest.json?${params.toString()}`
}