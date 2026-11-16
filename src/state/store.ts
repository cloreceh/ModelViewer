import { create } from 'zustand'
import {
  DEFAULT_PRODUCT,
  isAvailable,
  isModelId,
  isProductId,
  type ModelId,
  type ProductId,
} from '../data/catalog'
import { UNIT_PRESETS, type UnitPreset, type UnitSettings } from '../lib/units'

// The app's shared state (code plan piece 9): what's on the map and how
// it's shown. Screens read from here and change it through the actions.

export type ThemeSetting = 'light' | 'dark' | 'system'
export type Screen = 'menu' | 'map'

export interface AppState {
  screen: Screen
  model: ModelId
  productId: ProductId
  // The valid time on screen (ms). Undefined until a run is picked: the map
  // then opens on the run's first hour (F00, Week 6).
  validTime?: number
  // ?hour= from the address, used once the run is known.
  requestedHour?: number
  units: UnitSettings
  theme: ThemeSetting // the Settings screen sets it in Week 10
  legendLabels: boolean // tap the legend to hide or show band labels
  recentProducts: ProductId[] // newest first, up to 4 (product picker)

  openModel: (model: ModelId) => void // from the model menu
  setModel: (model: ModelId, productId?: ProductId) => void
  setProduct: (productId: ProductId) => void
  setValidTime: (time: number | undefined) => void
  restore: (view: {
    model: ModelId
    productId: ProductId
    validTime?: number
  }) => void
  toggleLegendLabels: () => void
}

const LEGEND_KEY = 'modelviewer.legendLabels'
const RECENT_KEY = 'modelviewer.recentProducts'
const RECENT_MAX = 4

// Browser storage can be missing or blocked (private mode); the app works
// without it, it just doesn't remember.
function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // not saved; fine
  }
}

function readRecent(): ProductId[] {
  try {
    const list = JSON.parse(readStored(RECENT_KEY) ?? '[]') as unknown
    return Array.isArray(list)
      ? list.filter(isProductId).slice(0, RECENT_MAX)
      : []
  } catch {
    return []
  }
}

function withRecent(list: ProductId[], id: ProductId): ProductId[] {
  const next = [id, ...list.filter((p) => p !== id)].slice(0, RECENT_MAX)
  writeStored(RECENT_KEY, JSON.stringify(next))
  return next
}

// The address picks the starting view: ?model=gfs&product=cape&hour=39
// opens that view straight away (a shared link); with no model the app
// opens on the model menu (Week 3). units= and theme= stay as test
// switches until Settings is built.
function fromAddress() {
  const q = new URLSearchParams(window.location.search)
  const asked = q.get('model')
  const model: ModelId = isModelId(asked) ? asked : 'hrrr'
  const askedProduct = q.get('product')
  const wanted: ProductId = isProductId(askedProduct)
    ? askedProduct
    : DEFAULT_PRODUCT
  const productId = isAvailable(wanted, model) ? wanted : DEFAULT_PRODUCT
  const preset = q.get('units') as UnitPreset | null
  const hour = q.get('hour')
  const theme = q.get('theme')
  return {
    screen: (isModelId(asked) ? 'map' : 'menu') as Screen,
    model,
    productId,
    requestedHour: hour !== null && hour !== '' ? Number(hour) : undefined,
    units:
      preset && preset in UNIT_PRESETS
        ? UNIT_PRESETS[preset]
        : UNIT_PRESETS.default,
    theme: (theme === 'light' || theme === 'dark'
      ? theme
      : 'system') as ThemeSetting,
  }
}

const start = fromAddress()

export const useAppStore = create<AppState>()((set) => ({
  ...start,
  legendLabels: readStored(LEGEND_KEY) !== 'hidden',
  recentProducts: withRecent(readRecent(), start.productId),

  // Picking a model from the menu opens SLP and precip at F00 (Weeks 3, 6).
  openModel: (model) =>
    set((s) => ({
      screen: 'map',
      model,
      productId: DEFAULT_PRODUCT,
      validTime: undefined,
      requestedHour: undefined,
      recentProducts: withRecent(s.recentProducts, DEFAULT_PRODUCT),
    })),
  // The valid time is kept across model and product changes (Week 3);
  // the time controls snap it to an hour the new choice has.
  setModel: (model, productId) =>
    set((s) => ({
      model,
      productId: productId ?? s.productId,
      requestedHour: undefined,
      recentProducts: productId
        ? withRecent(s.recentProducts, productId)
        : s.recentProducts,
    })),
  setProduct: (productId) =>
    set((s) => ({
      productId,
      requestedHour: undefined,
      recentProducts: withRecent(s.recentProducts, productId),
    })),
  setValidTime: (validTime) => set({ validTime, requestedHour: undefined }),
  // Undo: back to the view before a switch.
  restore: (view) =>
    set((s) => ({
      ...view,
      requestedHour: undefined,
      recentProducts: withRecent(s.recentProducts, view.productId),
    })),
  toggleLegendLabels: () =>
    set((s) => {
      writeStored(LEGEND_KEY, s.legendLabels ? 'hidden' : 'shown')
      return { legendLabels: !s.legendLabels }
    }),
}))
