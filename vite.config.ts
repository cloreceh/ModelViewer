import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// The weather map layer shares data with its workers through
// SharedArrayBuffer, which browsers only allow on "cross-origin isolated"
// pages. These two headers turn that on. Cloudflare Pages gets the same
// headers from public/_headers.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Web app manifest and service worker (Week 8). The service worker keeps
    // the app shell (HTML, code, the map layer's workers and decoder, icons)
    // on the phone. Weather files, the basemap and IEM tiles still come from
    // the network every time; caching frames is part of the offline states
    // (Week 11) and the performance pass.
    VitePWA({
      // A new version takes over on its own: when a push is deployed, the
      // next open loads it and the page reloads once (see main.tsx).
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        id: '/',
        // Placeholder name until the app is named (open decision)
        name: 'Model Viewer',
        short_name: 'Model Viewer',
        description:
          'Weather model maps (HRRR, GFS, ECMWF) for people who read the models themselves.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Not locked: landscape isn't designed but must still work (Week 7)
        orientation: 'any',
        // `surface` (status bar on Android) and `background` (splash screen)
        theme_color: '#FFFFFF',
        background_color: '#F4F4F2',
        // Placeholder icon B, exported from Figma (Week 6)
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Includes MapLibre's worker (.mjs) and the map layer's WebAssembly decoder
        globPatterns: ['**/*.{js,mjs,css,html,wasm,svg,png}'],
        // MapLibre and the decoder are over Workbox's 2 MB default
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Any address (?model=gfs&...) opens the cached page
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  // The map layer loads its worker and WebAssembly files from next to its
  // own code. Vite's dependency pre-bundling would move the code and break
  // those paths, so leave this package as it is.
  optimizeDeps: { exclude: ['@openmeteo/weather-map-layer'] },
})
