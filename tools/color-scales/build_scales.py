"""Draft color scales for the Week 4 core products.

Each palette is a ramp of anchor colors placed at physical values (in the data's
units). Every unit option gets its own round-number breakpoints, and each bin is
colored by sampling the ramp at the bin's lower edge, so the same physical value
gets the same color whatever units are picked.
"""
import json, math, pathlib

# ---------- color helpers (OKLab interpolation) ----------
def hex2rgb(h):
    h = h.lstrip('#'); return [int(h[i:i+2], 16) for i in (0, 2, 4)]
def rgb2hex(c): return '#%02x%02x%02x' % tuple(int(round(max(0, min(255, v)))) for v in c)
def _lin(c):
    c /= 255; return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def _gam(c):
    c = c*12.92 if c <= 0.0031308 else 1.055*c**(1/2.4)-0.055; return c*255
def rgb2oklab(rgb):
    r, g, b = (_lin(v) for v in rgb)
    l = 0.4122214708*r+0.5363325363*g+0.0514459929*b
    m = 0.2119034982*r+0.6806995451*g+0.1073969566*b
    s = 0.0883024619*r+0.2817188376*g+0.6299787005*b
    l, m, s = (v**(1/3) for v in (l, m, s))
    return [0.2104542553*l+0.7936177850*m-0.0040720468*s,
            1.9779984951*l-2.4285922050*m+0.4505937099*s,
            0.0259040371*l+0.7827717662*m-0.8086757660*s]
def oklab2rgb(lab):
    L, a, b = lab
    l = (L+0.3963377774*a+0.2158037573*b)**3
    m = (L-0.1055613458*a-0.0638541728*b)**3
    s = (L-0.0894841775*a-1.2914855480*b)**3
    return [_gam(4.0767416621*l-3.3077115913*m+0.2309699292*s),
            _gam(-1.2684380046*l+2.6097574011*m-0.3413193965*s),
            _gam(-0.0041960863*l-0.7034186147*m+1.7076147010*s)]
def ramp_color(anchors, v):
    """anchors: list of (value, hex) sorted by value. Step at duplicate values."""
    if v <= anchors[0][0]: return anchors[0][1]
    if v >= anchors[-1][0]: return anchors[-1][1]
    for (v0, c0), (v1, c1) in zip(anchors, anchors[1:]):
        if v0 <= v < v1:
            t = (v - v0) / (v1 - v0)
            a, b = rgb2oklab(hex2rgb(c0)), rgb2oklab(hex2rgb(c1))
            return rgb2hex(oklab2rgb([x+(y-x)*t for x, y in zip(a, b)]))
    return anchors[-1][1]

def frange(a, b, step):
    out, x = [], a
    while x <= b + 1e-9:
        out.append(round(x, 4)); x += step
    return out

# ---------- unit conversions: display unit -> data unit ----------
TO_DATA = {
    '°F': lambda v: (v-32)*5/9, '°C': lambda v: v,
    'kt': lambda v: v/1.94384, 'mph': lambda v: v/2.23694, 'm/s': lambda v: v,
    'in': lambda v: v*25.4, 'mm': lambda v: v,          # rain, PWAT (data in mm)
    'in_snow': lambda v: v*2.54, 'cm': lambda v: v,     # snowfall (data in cm)
    'J/kg': lambda v: v,
}
DATA_UNIT = {'°F': '°C', '°C': '°C', 'kt': 'm/s', 'mph': 'm/s', 'm/s': 'm/s',
             'in': 'mm', 'mm': 'mm', 'in_snow': 'cm', 'cm': 'cm', 'J/kg': 'J/kg'}

# ---------- ramps (anchor values in data units) ----------
F = lambda f: (f-32)*5/9          # °F -> °C, for writing temperature anchors in °F
KT = lambda k: k/1.94384          # kt -> m/s

TEMP = [  # shared by surface, 925 and 850mb: same color = same temperature
    (F(-40), '#4a1259'), (F(-25), '#7a2f9a'), (F(-10), '#6750c8'),
    (F(0), '#3f5fcf'), (F(15), '#3f8fdc'), (F(25), '#74bdec'), (F(31.999), '#b4e3f7'),
    (0.0, '#22876f'),  # sharp change at 32 °F / 0 °C: blues below, greens above
    (F(45), '#4fb36e'), (F(52), '#a6cf4a'), (F(60), '#f2e33a'), (F(70), '#f6b13a'),
    (F(80), '#ee6b2d'), (F(90), '#d2262b'), (F(100), '#94132e'),
    (F(110), '#5c0b2b'),
]
WIND = [  # upper-air wind speed, shared by 500 and 250mb
    (KT(30), '#b9dcf3'), (KT(50), '#7fbdea'), (KT(70), '#4a8fe0'),
    (KT(90), '#3b3fb0'), (KT(110), '#5e2399'), (KT(130), '#a8287f'),
    (KT(150), '#e8494a'), (KT(170), '#f2913a'), (KT(190), '#f6dc4a'),
]
CAPE = [
    (100, '#efdc6a'), (500, '#f0bb3e'), (1000, '#ec8530'), (1500, '#de4f2a'),
    (2000, '#c0263a'), (3000, '#8c1d6a'), (4000, '#5e2a9e'), (5000, '#9a68d6'),
    (6000, '#dcbcf4'),
]
PRECIP = [  # hourly precipitation, mm
    (0.25, '#8fd88a'), (1.27, '#55bf5a'), (2.54, '#3a9e47'), (5.08, '#2e8a3d'),
    (7.62, '#f2e33a'), (12.7, '#f39a2f'), (19.05, '#ad1f2c'), (25.4, '#650a22'),
    (38.1, '#c03fb5'), (50.8, '#8c5cd6'),
]
PWAT = [  # mm
    (0, '#a88258'), (12.7, '#b3cc74'), (19.05, '#6fc06a'), (25.4, '#2f9e8a'),
    (31.75, '#2f7fc8'), (38.1, '#3348b0'), (44.45, '#6a3aa8'), (50.8, '#a93aa6'),
    (63.5, '#e07ac8'),
]
# Snowfall: NWS snowfall-analysis style colors, one per bin (not interpolated).
SNOW_IN = [0.1, 1, 2, 3, 4, 6, 8, 12, 18, 24, 36, 48]
SNOW_COLORS = ['#a3c4e0', '#6baed6', '#3182bd', '#08519c', '#082694', '#f2e65c',
               '#ffc400', '#ff8700', '#db1400', '#9e0000', '#690000', '#8a3fd1']
SNOW_CM = [0.5, 2.5, 5, 7.5, 10, 15, 20, 30, 45, 60, 90, 120]
# Hourly snowfall (shown until totals are summed in the app): same NWS-style
# colors, steps sized for one hour.
SNOW_HOURLY_IN = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3]
SNOW_HOURLY_CM = [0.25, 0.5, 1, 2, 3, 4, 5, 7.5]
SNOW_HOURLY_COLORS = ['#a3c4e0', '#6baed6', '#3182bd', '#08519c', '#082694',
                      '#f2e65c', '#ffc400', '#ff8700']

def ins(lst, v):
    return sorted(set(lst + [v]))

# ---------- products: breakpoints per unit option (display units) ----------
PRODUCTS = {
  'surface_temperature': dict(label='Surface temperature', variable='temperature_2m',
      ramp=TEMP, transparent_below=False, default='°F',
      units={'°F': ins(frange(-40, 110, 5), 32), '°C': frange(-40, 44, 2)}),
  'temperature_925': dict(label='925mb temperature', variable='temperature_925hPa',
      ramp=TEMP, transparent_below=False, default='°C',
      units={'°C': frange(-36, 36, 2), '°F': ins(frange(-30, 95, 5), 32)}),
  'temperature_850': dict(label='850mb temperature', variable='temperature_850hPa',
      ramp=TEMP, transparent_below=False, default='°C',
      units={'°C': frange(-40, 32, 2), '°F': ins(frange(-40, 90, 5), 32)}),
  'wind_500': dict(label='500mb wind speed', variable='wind_speed_500hPa',
      ramp=WIND, transparent_below=True, default='kt',
      units={'kt': frange(30, 150, 10), 'mph': frange(40, 170, 10), 'm/s': frange(15, 75, 5)}),
  'wind_250': dict(label='250mb wind speed', variable='wind_speed_250hPa',
      ramp=WIND, transparent_below=True, default='kt',
      units={'kt': frange(50, 190, 10), 'mph': frange(60, 220, 10), 'm/s': frange(25, 100, 5)}),
  'cape': dict(label='CAPE', variable='cape', ramp=CAPE, transparent_below=True, default='J/kg',
      units={'J/kg': [100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000]}),
  'precipitation': dict(label='Hourly precipitation', variable='precipitation',
      ramp=PRECIP, transparent_below=True, default='in',
      units={'in': [0.01, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2],
             'mm': [0.25, 0.5, 1, 2, 3, 5, 7.5, 10, 15, 20, 30, 50]}),
  'precipitable_water': dict(label='Precipitable water',
      variable='total_column_integrated_water_vapour', ramp=PWAT, transparent_below=False,
      default='in',
      units={'in': [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5],
             'mm': frange(0, 65, 5)}),
}

def build():
    out = {}
    for key, p in PRODUCTS.items():
        out[key] = {'label': p['label'], 'variable': p['variable'], 'default_unit': p['default'], 'units': {}}
        for unit, bps in p['units'].items():
            conv = TO_DATA[unit]
            colors = [ramp_color(p['ramp'], conv(v)) for v in bps]
            data_bps = [round(conv(v), 4) for v in bps]
            alpha = [1.0]*len(bps)
            if p['transparent_below']:   # values below the first breakpoint are not drawn
                data_bps = [-1e9] + data_bps; colors = ['#000000'] + colors; alpha = [0.0] + alpha
            out[key]['units'][unit] = {'breakpoints': bps, 'data_unit': DATA_UNIT[unit],
                                       'data_breakpoints': data_bps, 'colors': colors, 'alpha': alpha}
    # snowfall: explicit per-bin colors
    out['snowfall'] = {'label': 'Snowfall totals (about 7:1)', 'variable': 'snowfall',
                       'default_unit': 'in', 'units': {}}
    for unit, bps, conv in (('in', SNOW_IN, TO_DATA['in_snow']), ('cm', SNOW_CM, TO_DATA['cm'])):
        out['snowfall']['units'][unit] = {'breakpoints': bps, 'data_unit': 'cm',
            'data_breakpoints': [-1e9] + [round(conv(v), 4) for v in bps],
            'colors': ['#000000'] + SNOW_COLORS, 'alpha': [0.0] + [1.0]*len(bps)}
    out['snowfall_hourly'] = {'label': 'Snowfall (past hour)', 'variable': 'snowfall',
                              'default_unit': 'in', 'units': {}}
    for unit, bps, conv in (('in', SNOW_HOURLY_IN, TO_DATA['in_snow']), ('cm', SNOW_HOURLY_CM, TO_DATA['cm'])):
        out['snowfall_hourly']['units'][unit] = {'breakpoints': bps, 'data_unit': 'cm',
            'data_breakpoints': [-1e9] + [round(conv(v), 4) for v in bps],
            'colors': ['#000000'] + SNOW_HOURLY_COLORS, 'alpha': [0.0] + [1.0]*len(bps)}
    return out

if __name__ == '__main__':
    scales = build()
    json.dump(scales, open(pathlib.Path(__file__).parent / 'scales.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    for k, v in scales.items():
        print(k, {u: len(d['breakpoints']) for u, d in v['units'].items()})
