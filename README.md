# ModelViewer

A mobile-first web app for viewing weather model output. Built for people with a meteorology background who get asked "is it going to rain tomorrow?" and want to answer from the models themselves, quickly, on their phone.

ModelViewer is my capstone project for the MS in User Experience Design at Michigan State University (Fall 2026).

## Status

In development (fall 2026). Live at [modelviewer-5yh.pages.dev](https://modelviewer-5yh.pages.dev).

- Every core product draws on the map from Open-Meteo (HRRR, GFS, ECMWF), with contours, wind barbs, a freezing line and HRRR simulated reflectivity from IEM
- Units follow a College of DuPage style mix by default
- Opens on a model menu (HRRR, GFS, ECMWF with each latest run and its age); pick one to open the map
- Run label and product menus, step buttons labeled with the step size, and a forecast-hour slider with day ticks that snaps to the model's hours
- Switch models at the same valid time, or pick a product from Recent or the College of DuPage style groups; a short message with Undo says when the app had to fall back or move the hour
- Floating legend (tap to hide its labels), a legend sheet with every band, and a map credits sheet
- Light and dark themes, following the phone's setting
- Installable: add it to your phone's home screen and it opens full screen. The app itself is kept on the phone, so repeat opens are quicker; the weather data still comes from the network
- The address follows the view, so it can be shared or reloaded: `?model=gfs&product=heights500&hour=39` (`&units=metric` and `&theme=dark` are test switches until Settings is built)

## Planned for v1

- Models: HRRR, GFS and ECMWF IFS (latest run)
- Products organized like College of DuPage: upper air (250 to 925 mb), surface, convective, precipitation and winter
- Run label, forecast-hour slider with day ticks, and step buttons (done)
- Switch models at the same valid time (done)
- Tap the map for point values
- Location search, units setting, theme setting
- Loading, offline and error states
- Installable on your phone's home screen (done)

Planned after the semester: meteogram and model comparison views, soundings, and my own data backend for more products.

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/), built with [Vite](https://vite.dev/)
- [MapLibre GL JS](https://maplibre.org/) for the map
- [Open-Meteo weather map layer](https://www.npmjs.com/package/@openmeteo/weather-map-layer) to draw Open-Meteo's map files
- [Zustand](https://zustand.docs.pmnd.rs/) for the app's shared state
- [Lucide](https://lucide.dev/) icons (ISC license)
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
  state/      Shared app state: model, product, valid time, units, theme; toasts
  data/       Model and product catalog, plus the data adapter
  map/        Map view, basemap, weather layers, legend, map buttons and credits
  time/       Run label, forecast-hour slider and step buttons
  features/   Model menu, model switch, product picker (location search and settings next)
  ui/         Colors and type (theme.css), sheets and toasts
  lib/        Small shared helpers: units, time math, text measuring
```

## Data and credits

- Basemap: [OpenFreeMap](https://openfreemap.org/), © [OpenMapTiles](https://www.openmaptiles.org/), map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- U.S. state and national borders: U.S. Census Bureau, via [us-atlas](https://github.com/topojson/us-atlas)
- Weather model data: [Open-Meteo](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- HRRR simulated reflectivity: [Iowa Environmental Mesonet](https://mesonet.agron.iastate.edu/), Iowa State University

## License

GNU General Public License v2.0. See [LICENSE](LICENSE).
