"""Task 4 checks: colorblind confusion and basemap contrast for every palette."""
import json, itertools, sys
sys.path.insert(0, '.')
from build_scales import hex2rgb, rgb2oklab, _lin, _gam

# Machado et al. (2009) full-severity matrices, applied in linear RGB
CVD = {
 'protanopia':   [[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
 'deuteranopia': [[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
 'tritanopia':   [[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]],
}
def simulate(rgb, kind):
    lin = [_lin(v) for v in rgb]
    m = CVD[kind]
    out = [sum(m[r][c]*lin[c] for c in range(3)) for r in range(3)]
    return [_gam(max(0, min(1, v))) for v in out]
def dE(a, b):
    A, B = rgb2oklab(a), rgb2oklab(b)
    return sum((x-y)**2 for x, y in zip(A, B))**0.5
def over(rgb, bg, alpha):
    return [alpha*c + (1-alpha)*b for c, b in zip(rgb, bg)]

BG = {'light': [242, 243, 240], 'dark': [12, 12, 12]}
ALPHA = 0.8          # assumed shading opacity (same as reflectivity in Spike 2)
CONFUSE = 0.045      # OKLab distance below which two bands look alike
FADE = 0.12          # OKLab distance from the basemap below which a band fades into it

S = json.load(open(__import__('pathlib').Path(__file__).parent / 'scales.json', encoding='utf-8'))
report = {}
for key, p in S.items():
    u = p['default_unit']; d = p['units'][u]
    bps, cols = d['breakpoints'], d['colors']
    if d['alpha'][0] == 0: cols = cols[1:]
    rgbs = [hex2rgb(c) for c in cols]
    r = {'label': p['label'], 'unit': u, 'confusions': {}, 'fades': {}, 'lightness': []}
    n = len(rgbs)
    gap = max(3, n // 6)   # only far-apart bands count as confusable
    for kind in ['normal'] + list(CVD):
        sim = rgbs if kind == 'normal' else [simulate(c, kind) for c in rgbs]
        bad = []
        for i, j in itertools.combinations(range(n), 2):
            if j - i >= gap and dE(sim[i], sim[j]) < CONFUSE:
                bad.append((bps[i], bps[j], round(dE(sim[i], sim[j]), 3)))
        r['confusions'][kind] = bad
    for t, bg in BG.items():
        r['fades'][t] = [(bps[i], round(dE(over(c, bg, ALPHA), bg), 3)) for i, c in enumerate(rgbs)
                         if dE(over(c, bg, ALPHA), bg) < FADE]
    r['lightness'] = [round(rgb2oklab(c)[0], 2) for c in rgbs]
    report[key] = r

if __name__ == "__main__":
  for k, r in report.items():
      print(f"\n## {r['label']} ({r['unit']})")
      for kind, bad in r['confusions'].items():
          if bad: print(f"  {kind}: {len(bad)} far-apart pairs look alike, e.g. {bad[:4]}")
      for t, f in r['fades'].items():
          if f: print(f"  fades on {t}: {f}")
      print('  lightness:', r['lightness'])
  
