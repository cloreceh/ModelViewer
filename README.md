# ModelViewer

A mobile-first web app for viewing weather model output. Built for people with a meteorology background who get asked "is it going to rain tomorrow?" and want to answer from the models themselves, quickly, on their phone.

ModelViewer is my capstone project for the MS in User Experience Design at Michigan State University (Fall 2026).

## Status

In development (fall 2026). Live at [modelviewer-5yh.pages.dev](https://modelviewer-5yh.pages.dev).

- Every core product draws on the map from Open-Meteo (HRRR, GFS, ECMWF), with contours, wind barbs, a freezing line and HRRR simulated reflectivity from IEM
- Units follow a College of DuPage style mix by default
- Installable: add it to your phone's home screen and it opens full screen. The app itself is kept on the phone, so repeat opens are quicker; the weather data still comes from the network
- Until the pickers are built, the address picks what's shown: `?model=gfs&product=heights500&units=metric&theme=dark&hour=6`

## Planned for v1

- Models: HRRR, GFS and ECMWF IFS (latest run)
- Products organized like College of DuPage: upper air (250 to 925 mb), surface, convective, precipitation and winter
- Run label, forecast-hour slider with day ticks, and step buttons
- Tap the map for point values; switch models at the same valid time
- Location search, units setting, light and dark themes
- Installable on your phone's home screen (done)

Planned after the semester: meteogram and model comparison views, soundings, and my own data backend for more products.

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/), built with [Vite](https://vite.dev/)
- [MapLibre GL JS](https://maplibre.org/) for the map
- [Open-Meteo weather map layer](https://www.npmjs.com/package/@openmeteo/weather-map-layer) to draw Open-Meteo's map files
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) for the web app manifest and service worker
- [ECharts](https://echarts.apache.org/) for charts (after the semester)
- ESLint and Prettier for code quality and formatting

## Running it locally

You'll need [Node.js](https://nodejs.org/) (LTS) and Git.

```bash
git clone https://github.com/cloreceh/ModelViewer.git
cd ModelViewer
npm install
npm run dev
```

Then open the `localhost` link shown in the terminal.

The service worker is only in the production build. To try it locally, run `npm run build` and then `npm run preview`.

**Windows note:** if PowerShell says running scripts is disabled, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt instead.

## Scripts

| Command           | What it does                                               |
| ----------------- | ---------------------------------------------------------- |
| `npm run dev`     | Starts the local dev server                                |
| `npm run build`   | Type-checks and builds the production version into `dist/` |
| `npm run preview` | Serves the production build locally                        |
| `npm run lint`    | Checks the code for problems                               |
| `npm test`        | Runs the unit tests (Vitest)                               |
| `npm run format`  | Formats all files with Prettier                            |

## Project structure

```
src/
  app/        App shell: main layout, screens and providers
  state/      Shared app state: model, product, forecast hour, location, theme
  data/       Model and product catalog, plus the data adapter
  map/        Map view, basemap, weather layers and legend
  time/       Run label, forecast-hour slider and step buttons
  features/   Model menu, model switch, product picker, location search, settings
  lib/        Small shared helpers
```

## Data and credits

- Basemap: [OpenFreeMap](https://openfreemap.org/), © [OpenMapTiles](https://www.openmaptiles.org/), map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- U.S. state and national borders: U.S. Census Bureau, via [us-atlas](https://github.com/topojson/us-atlas)
- Weather model data: [Open-Meteo](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- HRRR simulated reflectivity: [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/), Iowa State University

## License

GNU General Public License v2.0. See [LICENSE](LICENSE).
