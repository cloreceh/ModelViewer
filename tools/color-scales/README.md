# Color scales

Where the map's color scales come from (Week 4 of the capstone).

- `build_scales.py`: the palettes. Each one is a set of anchor colors at real values (32 °F, 100 kt), blended in the OKLab color space. Every unit option gets its own round-number breakpoints, and each band takes the color at its lower edge, so the same value has the same color in every unit. Writes `scales.json`.
- `check_palettes.py`: simulates protanopia, deuteranopia and tritanopia and checks each band against the light and dark basemap land colors. Prints any far-apart bands that look alike and any band that fades into the basemap.
- `make_ts.py`: writes `src/data/colorScaleData.ts` from `scales.json`. The app reads only that file.

To change a palette: edit `build_scales.py`, then run

```
python build_scales.py
python check_palettes.py
python make_ts.py
```

and update the Figma "Color scales" section to match.
