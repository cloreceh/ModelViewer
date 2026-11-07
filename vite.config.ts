import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  // The map layer loads its worker and WebAssembly files from next to its
  // own code. Vite's dependency pre-bundling would move the code and break
  // those paths, so leave this package as it is.
  optimizeDeps: { exclude: ['@openmeteo/weather-map-layer'] },
})