'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { Circle, CircleMarker, GeoJSON, MapContainer, Pane, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { LatLngBoundsExpression, LeafletMouseEvent, PathOptions, Polygon } from 'leaflet'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import type { SearchLocation } from '@/lib/supabase/types'
import type { GeoPlace } from '@/lib/geo/nominatim'
import { CITY_HUB_SUGGESTIONS } from '../cityHubSuggestions'

type CountryFeature = Feature<MultiPolygon, { iso2: string }>
type CountryCollection = FeatureCollection<MultiPolygon, { iso2: string }>

export interface LocationMapProps {
  locations: SearchLocation[]
  /** Map flies here when it changes (e.g. after a text-search pick). */
  focus: { lat: number; lng: number } | null
  /** A hub marker was clicked — place is already resolved, no geocoding needed. */
  onPick: (place: GeoPlace) => void
  /** Click inside the already-selected supported country — caller reverse-geocodes. */
  onPickPoint: (lat: number, lng: number) => void
  /** Click on sea / unsupported country. */
  onUnsupported: () => void
}

const EUROPE_BOUNDS: LatLngBoundsExpression = [[33, -27], [72, 46]]

// Legacy data can hold duplicate cities (case/country variants): include the index.
const markerKey = (l: SearchLocation, i: number) =>
  `${l.ville.toLowerCase()}|${(l.pays ?? 'FR').toUpperCase()}|${i}`

// Leaflet writes colours as SVG attributes, where CSS var() does not resolve.
function readAccent(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1'
}

// The wizard modal scales in with GSAP; Leaflet measures its container at mount,
// so re-measure once the animation is done.
function InvalidateSizeOnMount() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function FlyToFocus({ focus }: { focus: LocationMapProps['focus'] }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 7), { duration: 0.6 })
  }, [focus, map])
  return null
}

function UnsupportedClicks({ onUnsupported }: { onUnsupported: () => void }) {
  // Country polygons and hub markers set bubblingMouseEvents=false, so this only
  // fires for clicks outside supported countries.
  useMapEvents({ click: () => onUnsupported() })
  return null
}

function CountriesLayer({
  geo, accent, selectedCountry, onSelectCountry, onPickPoint,
}: {
  geo: CountryCollection
  accent: string
  selectedCountry: string | null
  onSelectCountry: (iso2: string) => void
  onPickPoint: (lat: number, lng: number) => void
}) {
  const map = useMap()

  const style = (feature?: CountryFeature): PathOptions => ({
    className: 'europe-country',
    color: accent,
    weight: 1,
    fillColor: accent,
    fillOpacity: feature?.properties.iso2 === selectedCountry ? 0.18 : 0.06,
  })

  return (
    <GeoJSON
      data={geo}
      style={style as (f?: Feature) => PathOptions}
      bubblingMouseEvents={false}
      eventHandlers={{
        click: (e: LeafletMouseEvent) => {
          // GeoJSON is a FeatureGroup: the clicked country polygon is e.propagatedFrom.
          const layer = e.propagatedFrom as Polygon & { feature: CountryFeature }
          const iso2 = layer.feature.properties.iso2
          if (iso2 === selectedCountry) {
            onPickPoint(e.latlng.lat, e.latlng.lng)
          } else {
            onSelectCountry(iso2)
            map.fitBounds(layer.getBounds(), { padding: [16, 16] })
          }
        },
      }}
    />
  )
}

export function LocationMap({ locations, focus, onPick, onPickPoint, onUnsupported }: LocationMapProps) {
  const [geo, setGeo] = useState<CountryCollection | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [accent] = useState(readAccent)

  useEffect(() => {
    let cancelled = false
    fetch('/geo/europe-countries.json')
      .then(r => r.json() as Promise<CountryCollection>)
      .then(data => { if (!cancelled) setGeo(data) })
      .catch(() => { /* map still usable via search box + list */ })
    return () => { cancelled = true }
  }, [])

  const hubs = selectedCountry ? CITY_HUB_SUGGESTIONS[selectedCountry] ?? [] : []
  const placed = locations.filter(l => l.lat !== undefined && l.lng !== undefined)

  return (
    <MapContainer
      bounds={EUROPE_BOUNDS}
      maxBounds={EUROPE_BOUNDS}
      maxBoundsViscosity={1}
      minZoom={3}
      worldCopyJump={false}
      className="h-72 w-full rounded-xl z-0"
      style={{ border: '1px solid var(--border)' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <InvalidateSizeOnMount />
      <FlyToFocus focus={focus} />
      <UnsupportedClicks onUnsupported={onUnsupported} />

      {/* Below the default overlay pane (400) so circles and markers draw on top. */}
      <Pane name="countries" style={{ zIndex: 350 }}>
        {geo && (
          <CountriesLayer
            geo={geo}
            accent={accent}
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
            onPickPoint={onPickPoint}
          />
        )}
      </Pane>

      {placed.map((l, i) => (
        <Circle
          key={`circle-${markerKey(l, i)}`}
          center={[l.lat!, l.lng!]}
          radius={l.rayon_km * 1000}
          interactive={false}
          pathOptions={{ color: accent, weight: 1.5, fillColor: accent, fillOpacity: 0.12 }}
        />
      ))}

      {hubs.map(hub => (
        <CircleMarker
          key={`hub-${hub.name}`}
          center={[hub.lat, hub.lng]}
          radius={6}
          bubblingMouseEvents={false}
          pathOptions={{ color: accent, weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
          eventHandlers={{
            click: () => onPick({ ville: hub.name, pays: selectedCountry!, lat: hub.lat, lng: hub.lng }),
          }}
        >
          <Tooltip direction="top" offset={[0, -6]}>{hub.name}</Tooltip>
        </CircleMarker>
      ))}

      {placed.map((l, i) => (
        <CircleMarker
          key={`dot-${markerKey(l, i)}`}
          center={[l.lat!, l.lng!]}
          radius={5}
          interactive={false}
          pathOptions={{ color: accent, weight: 2, fillColor: accent, fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]}>{l.ville}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
