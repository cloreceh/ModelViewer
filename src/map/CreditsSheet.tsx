import { product, type ProductId } from '../data/catalog'
import { Sheet } from '../ui/Sheet'

interface Credit {
  name: string
  href: string
  what: string
  extra?: { name: string; href: string } // a second link on the same row
}

const CREDITS: Record<
  'openMeteo' | 'iem' | 'basemap' | 'osm' | 'census',
  Credit
> = {
  openMeteo: {
    name: 'Open-Meteo',
    href: 'https://open-meteo.com/',
    what: 'Model data (HRRR, GFS, ECMWF IFS) · CC BY 4.0',
  },
  iem: {
    name: 'Iowa Environmental Mesonet',
    href: 'https://mesonet.agron.iastate.edu/',
    what: 'HRRR simulated reflectivity',
  },
  basemap: {
    name: 'OpenFreeMap',
    href: 'https://openfreemap.org/',
    what: 'Basemap',
  },
  osm: {
    name: '© OpenMapTiles',
    href: 'https://www.openmaptiles.org/',
    what: 'Map data',
    extra: {
      name: '© OpenStreetMap contributors',
      href: 'https://www.openstreetmap.org/copyright',
    },
  },
  census: {
    name: 'U.S. Census Bureau',
    href: 'https://www.census.gov/geographies/mapping-files.html',
    what: 'State borders',
  },
}

// The map credits sheet (09), opened from the (i) button: the sources in
// the current view, each linking to its site. Replaces MapLibre's
// attribution strip; Open-Meteo's CC BY 4.0 license asks for credit where
// the data is shown.
export function CreditsSheet({
  productId,
  onClose,
}: {
  productId: ProductId
  onClose: () => void
}) {
  const layers = product(productId).layers
  const usesIem = layers.some((l) => l.kind === 'iem-reflectivity')
  const usesOpenMeteo = layers.some((l) => l.kind !== 'iem-reflectivity')
  const rows = [
    usesOpenMeteo && CREDITS.openMeteo,
    usesIem && CREDITS.iem,
    CREDITS.basemap,
    CREDITS.osm,
    CREDITS.census,
  ].filter(Boolean) as Credit[]

  return (
    <Sheet
      title="Map credits"
      subtitle="Data and maps in this view"
      onClose={onClose}
    >
      <ul className="credit-rows">
        {rows.map((c) => (
          <li key={c.name} className="credit-row">
            <span className="credit-links">
              <a
                className="t-callout-strong"
                href={c.href}
                target="_blank"
                rel="noreferrer"
              >
                {c.name}
              </a>
              {c.extra && (
                <a
                  className="t-callout-strong"
                  href={c.extra.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {c.extra.name}
                </a>
              )}
            </span>
            <span className="credit-what t-caption">{c.what}</span>
          </li>
        ))}
      </ul>
      {/* "Licenses and app info in Settings" links to Settings once it
          exists (Week 10). */}
    </Sheet>
  )
}
