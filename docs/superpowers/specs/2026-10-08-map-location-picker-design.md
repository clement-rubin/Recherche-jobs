# Map location picker — design

**Date:** 2026-10-08
**Status:** approved — synced with the implementation after review

## Goal

Replace the "Villes" wizard step's text inputs (ville / pays select / rayon number) with a visual picker: the user picks country and city on a map and sets the radius with a slider.

## Scope decisions

- **Europe-centred map.** Scrapers (JSearch, EURES, France Travail) only cover the 32 countries in `components/search/countries.ts`. The map is bounded to Europe; only those 32 countries are highlighted and selectable. No scraper changes.
- **Leaflet + OpenStreetMap ecosystem.** No API key. Basemap: CARTO Positron (light, matches zinc theme), attribution shown. Geocoding: Nominatim, called from the browser.
- **No DB migration.** `localisations` is `jsonb`; new optional fields are additive.

## User flow (step "Villes" of `WizardModal`)

1. Map shows Europe (`maxBounds` = Europe). Supported countries are drawn as GeoJSON polygons (loaded from `/geo/europe-countries.json`), tinted on hover.
2. Click a supported country → map fits that country's bounds, and that country's hub cities (`CITY_HUB_SUGGESTIONS`) appear as clickable markers.
3. Click a hub marker → city added directly (name + coords from the hub table, no network).
   Click anywhere else inside the selected country → `reverseGeocode` → nearest city/town/village added (or "Ville introuvable à cet endroit").
   Click outside a supported country, or a reverse-geocoded city in an unsupported country → inline message "Pays non couvert par la recherche".
4. New location defaults: `rayon_km: 30`. Duplicate (same ville + pays, case-insensitive) is ignored.
5. Every selected location renders a marker + a `Circle` of radius `rayon_km * 1000` m.
6. Below the map, one row per location: city name, country label, slider `0–100` step `5` showing live "`N` km", remove button `✕` (`aria-label="Supprimer la ville <ville>"`). Moving the slider updates the circle live. Legacy rows with a radius outside `0–100` are clamped **for display only** (slider and label); the stored value is not rewritten unless the user moves the slider.
7. A text search box above the map ("Rechercher une ville…") with a "Rechercher" button. **Explicit search only**: the request runs on Enter in the input (default prevented, so the surrounding wizard is never submitted) or on the button — never while typing (Nominatim's usage policy forbids client-side autocomplete, and it does not prefix-match). Min 2 chars (shorter → no request), restricted to the 32 country codes, up to 5 results; picking one adds it and pans the map. Editing the query clears the results and invalidates any in-flight search (sequence counter), so stale results can never appear. This is the keyboard/accessibility fallback.
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

Scrapers ignore `lat`/`lng`. Default rows carry coords (`{ ville: 'Lille', rayon_km: 30, pays: 'FR', lat: 50.629, lng: 3.057 }` in `WizardModal` and the `POST /api/search-profiles` fallback), so new profiles trigger no geocoding.

Legacy locations without coords: `StepVilles` forward-geocodes them once on mount (`searchCity(ville, [pays])`, first hit) to draw their circle, and writes coords back via `onChange`. Requests are **throttled**: sequential, ≥1100 ms apart (no wait before the first), and the loop stops as soon as the step unmounts. Failure is silent (row still listed, just no circle).

## City-name language

Nominatim is called with `accept-language=fr` and `namedetails=1`:

- **France** → French address name ("Dunkerque", not "Dunkirk"). The French scrapers (France Travail commune lookup by name, APEC, HelloWork) need French names.
- **Other countries** → `namedetails['name:en']` when present ("Munich", "Vienna"), matching `CITY_HUB_SUGGESTIONS` and what JSearch expects; otherwise the address city/town/village/municipality.
- The result's own `name` is used as a fallback **only for search results**. Reverse results without a city/town/village return `null` (their `name` can be a county or arrondissement).

## Components / files

| File | Responsibility |
|---|---|
| `lib/geo/nominatim.ts` | `reverseGeocode(lat, lng)` → `GeoPlace \| null`; `searchCity(q, countryCodes)` → `GeoPlace[]` (`GeoPlace = { ville, pays, lat, lng }`). Pure fetch wrappers, never throw, `format=jsonv2`, language rule above. Pays returned as uppercase ISO2. |
| `scripts/build-europe-geo.cjs` | One-off build script (`node scripts/build-europe-geo.cjs`): converts `world-atlas/countries-50m.json` (topojson; 1:50m because 1:110m lacks Malta and Liechtenstein) to GeoJSON, keeps the 32 supported countries via an ISO-numeric → ISO2 table, drops overseas parts, rounds coords. |
| `public/geo/europe-countries.json` | Pre-built output of the script: `FeatureCollection` of 32 `MultiPolygon` features with `properties.iso2`. Fetched by the map at runtime — no topojson conversion in the browser. |
| `components/search/map/LocationMap.tsx` | Leaflet map (`react-leaflet`). Props: `locations`, `focus: {lat,lng} \| null`, `onPick(place)` (hub clicked), `onPickPoint(lat, lng)` (click in selected country, caller reverse-geocodes), `onUnsupported()`. Renders countries layer, hub markers for the selected country, selected markers + circles. Never imported directly by server code. |
| `components/search/cityHubSuggestions.ts` | Hubs are `{ name, lat, lng }[]` per country. |
| `components/search/steps/StepVilles.tsx` | Rewritten: search box + button, `LocationMap` (via `next/dynamic`, `ssr: false`, loading placeholder), list with sliders, throttled legacy backfill. Props unchanged (`value`, `onChange`). |
| `components/search/WizardModal.tsx` | Modal widens to `max-w-2xl` on the Villes step so the map is usable; default row has coords. |
| `lib/supabase/types.ts` | `lat?`, `lng?` on `SearchLocation`. |
| `next.config.ts` | CSP `connect-src` includes `https://nominatim.openstreetmap.org` (geocoding runs in the browser). Tiles are covered by the existing `img-src https:`. |

## Dependencies

Runtime: `leaflet`, `react-leaflet` (v5, React 19). Dev: `@types/leaflet`, plus `world-atlas` and `topojson-client` used only by `scripts/build-europe-geo.cjs`. Leaflet CSS imported in `LocationMap.tsx`.

## Error handling

- Nominatim error / no result → inline message ("Ville introuvable" for search, "Ville introuvable à cet endroit" for a map click), no crash. Search box stays usable.
- Country borders file fails to load → map still usable via search box + list.
- Tiles fail to load → list + sliders still work.
- Nominatim policy (≤1 req/s, no autocomplete): reverse geocode only on explicit click; search only on Enter / button; legacy backfill throttled to ≥1100 ms between requests.

## Testing

- `__tests__/lib/geo/nominatim.test.ts` — `fetch` mocked: city/town/village fallback, uppercase country, `null`/`[]` on error, `accept-language=fr` + `namedetails=1` sent, French name kept for FR, `name:en` used elsewhere, reverse result with only `name` → `null`, search result `name` fallback.
- `__tests__/components/search/steps/StepVilles.test.tsx` — `next/dynamic` map mocked with a stub exposing buttons for `onPick` / `onPickPoint` / `onUnsupported`; tests: rows rendered with slider values, slider change, remove, hub pick with default radius, duplicate ignored, reverse-geocode add / not found / unsupported country, outside click message, search on Enter and on button, no search while typing or under 2 chars, results cleared on query change and in-flight results dropped, legacy backfill (single row, and 2 rows with fake timers asserting the 1100 ms spacing and stop on unmount), radius clamped for display.
- `__tests__/components/search/WizardModal.test.tsx` — map and Nominatim mocked; existing tests keep passing; a new profile reaching the Villes step triggers no geocoding.
- `LocationMap` itself is not unit-tested (Leaflet does not run in jsdom); verified in the browser.
