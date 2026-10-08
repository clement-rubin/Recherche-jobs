# Map location picker — design

**Date:** 2026-10-08
**Status:** approved

## Goal

Replace the "Villes" wizard step's text inputs (ville / pays select / rayon number) with a visual picker: the user picks country and city on a map and sets the radius with a slider.

## Scope decisions

- **Europe-centred map.** Scrapers (JSearch, EURES, France Travail) only cover the 32 countries in `components/search/countries.ts`. The map is bounded to Europe; only those 32 countries are highlighted and selectable. No scraper changes.
- **Leaflet + OpenStreetMap ecosystem.** No API key. Basemap: CARTO Positron (light, matches zinc theme), attribution shown. Geocoding: Nominatim, called from the browser.
- **No DB migration.** `localisations` is `jsonb`; new optional fields are additive.

## User flow (step "Villes" of `WizardModal`)

1. Map shows Europe (`maxBounds` = Europe). Supported countries are drawn as GeoJSON polygons, tinted on hover.
2. Click a supported country → map fits that country's bounds, and that country's hub cities (`CITY_HUB_SUGGESTIONS`) appear as clickable markers.
3. Click a hub marker → city added directly (name + coords from the hub table, no network).
   Click anywhere else inside a supported country → `reverseGeocode` → nearest city/town/village added.
   Click outside a supported country → inline message "Pays non couvert par la recherche".
4. New location defaults: `rayon_km: 30`. Duplicate (same ville + pays) is ignored.
5. Every selected location renders a marker + a `Circle` of radius `rayon_km * 1000` m.
6. Below the map, one row per location: city name, country label, slider `0–100` step `5` showing live "`N` km", remove button `✕` (`aria-label="Supprimer la ville <ville>"`). Moving the slider updates the circle live.
7. A text search box above the map ("Rechercher une ville…") queries `searchCity` (debounced 400 ms, min 2 chars, restricted to the 32 country codes) and shows up to 5 results; picking one adds it and pans the map. This is the keyboard/accessibility fallback.
8. Existing hint kept: radius only applies to French sources.

## Data model

```ts
export interface SearchLocation {
  ville: string
  rayon_km: number
  pays?: string
  lat?: number   // new, optional
  lng?: number   // new, optional
}
```

Scrapers ignore `lat`/`lng`. Legacy locations without coords: the map forward-geocodes them once on mount (`searchCity(ville, pays)`, first hit) to draw their circle, and writes coords back via `onChange`. Failure is silent (row still listed, just no circle).

## Components / files

| File | Responsibility |
|---|---|
| `lib/geo/nominatim.ts` | `reverseGeocode(lat, lng)` → `{ ville, pays, lat, lng } \| null`; `searchCity(q, countryCodes)` → array of same. Pure fetch wrappers, `accept-language=fr`, `format=jsonv2`. Pays returned as uppercase ISO2. |
| `components/search/map/europeGeo.ts` | Converts `world-atlas/countries-110m.json` (topojson) to GeoJSON, filters to the 32 supported countries via an ISO-numeric → ISO2 table. |
| `components/search/map/LocationMap.tsx` | Leaflet map (`react-leaflet`). Props: `locations`, `onPick(loc)`, `focus?: {lat,lng}`. Renders countries layer, hub markers for focused country, selected markers + circles. Never imported directly by server code. |
| `components/search/cityHubSuggestions.ts` | Hubs become `{ name, lat, lng }[]` per country. |
| `components/search/steps/StepVilles.tsx` | Rewritten: search box + `LocationMap` (via `next/dynamic`, `ssr: false`, loading placeholder) + list with sliders. Props unchanged (`value`, `onChange`). |
| `components/search/WizardModal.tsx` | Modal widens to `max-w-2xl` on the Villes step so the map is usable. |
| `lib/supabase/types.ts` | `lat?`, `lng?` on `SearchLocation`. |

## Dependencies

`leaflet`, `react-leaflet` (v5, React 19), `world-atlas`, `topojson-client`; dev: `@types/leaflet`, `@types/topojson-client`. Leaflet CSS imported in `LocationMap.tsx`.

## Error handling

- Nominatim error / no result → inline message "Ville introuvable", no crash. Search box stays usable.
- Tiles fail to load → list + sliders still work.
- Nominatim policy (≤1 req/s): reverse geocode only on explicit click; search debounced.

## Testing

- `__tests__/lib/geo/nominatim.test.ts` — `fetch` mocked: parses city/town/village fallback, uppercases country, returns `null`/`[]` on error.
- `__tests__/components/search/steps/StepVilles.test.tsx` rewritten — `next/dynamic` map mocked with a stub exposing a button that calls `onPick`; tests: rows rendered with slider values, slider change updates `rayon_km`, remove button, pick adds location with default radius, duplicate ignored, search results add a location (`searchCity` mocked).
- `europeGeo` — test that exactly the 32 supported ISO2 codes are produced.
- Existing `WizardModal` tests must keep passing.
