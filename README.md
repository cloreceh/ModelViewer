# ModelViewer

A mobile-first web app for viewing weather model output. Built for people with a meteorology background who get asked "is it going to rain tomorrow?" and want to answer from the models themselves, quickly, on their phone.

ModelViewer is my capstone project for the MS in User Experience Design at Michigan State University (Fall 2026).

## Status

Early development. Right now the app shows a basemap of the continental U.S. with state borders. Weather model layers come next.

## Planned for v1

- Models: HRRR, GFS and ECMWF IFS (latest run)
- Products organized like College of DuPage: upper air (250 to 925 mb), surface, convective, precipitation and winter
- Forecast-hour slider, step buttons and animation
- Tap the map for point values; meteogram and model comparison charts
- Light and dark themes; installable on your phone's home screen

## Tech stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/), built with [Vite](https://vite.dev/)
- [MapLibre GL JS](https://maplibre.org/) for the map
- [ECharts](https://echarts.apache.org/) for charts (planned)
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

**Windows note:** if PowerShell says running scripts is disabled, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt instead.

## Scripts

| Command           | What it does                                               |
| ----------------- | ---------------------------------------------------------- |
| `npm run dev`     | Starts the local dev server                                |
| `npm run build`   | Type-checks and builds the production version into `dist/` |
| `npm run preview` | Serves the production build locally                        |
| `npm run lint`    | Checks the code for problems                               |
| `npm run format`  | Formats all files with Prettier                            |

## Project structure

```
src/
  app/        App shell: main layout, screens and providers
  state/      Shared app state: model, product, forecast hour, location, theme
  data/       Model and product catalog, plus the data adapter
  map/        Map view, basemap, weather layers and legend
  time/       Run label, forecast-hour slider and animation
  features/   Model menu, product picker, location search, charts
  lib/        Small shared helpers
```

## Data and credits

- Basemap: [OpenFreeMap](https://openfreemap.org/), © [OpenMapTiles](https://www.openmaptiles.org/), map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- U.S. state and national borders: U.S. Census Bureau, via [us-atlas](https://github.com/topojson/us-atlas)
- Weather model data (coming soon): [Open-Meteo](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

## License

GNU General Public License v2.0. See [LICENSE](LICENSE).
