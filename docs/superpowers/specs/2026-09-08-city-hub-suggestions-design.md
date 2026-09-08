# City hub suggestions in onboarding — design spec

Date: 2026-09-08

## Problem

`StepVilles` (onboarding wizard, city step) now lets a user pick a country per row (added in the Europe-wide internship search feature). But the `ville` field is a blank free-text input — the user has to already know which cities are worth targeting in a country they may not be familiar with. When they pick, say, Germany, nothing suggests Berlin/Munich/Hamburg as strong tech-hiring hubs.

Goal: after picking a country on a row, suggest a handful of known recruiting hubs for that country, one click away.

## Scope decision (from clarifying questions)

The original ask framed this as domain-aware ("suggest hubs for the Data/IA domain specifically"). In practice, the cities that concentrate tech/office hiring in a country (capital + 2-4 major metros) are largely the same regardless of which of the wizard's 7 domains (`data_ia`, `dev_logiciel`, `devops_cloud`, `cybersecurite`, `product_design`, `reseaux_infra`, `support_it`) the profile targets — curating 32 countries × 7 domains (224 lists) would be a maintenance burden with little real payoff. **Decision (confirmed with user): one city list per country, domain-agnostic.** No `domaineKey` threading into `StepVilles` is needed.

## Data

New file `components/search/cityHubSuggestions.ts`:

```ts
export const CITY_HUB_SUGGESTIONS: Record<string, string[]> = {
  FR: ['Paris', 'Lyon', 'Toulouse', 'Lille', 'Nantes'],
  DE: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'],
  AT: ['Vienna', 'Graz', 'Linz'],
  BE: ['Brussels', 'Antwerp', 'Ghent'],
  BG: ['Sofia', 'Plovdiv'],
  CY: ['Nicosia', 'Limassol'],
  HR: ['Zagreb', 'Split'],
  DK: ['Copenhagen', 'Aarhus'],
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Bilbao'],
  EE: ['Tallinn', 'Tartu'],
  FI: ['Helsinki', 'Tampere', 'Espoo'],
  GR: ['Athens', 'Thessaloniki'],
  HU: ['Budapest', 'Debrecen'],
  IE: ['Dublin', 'Cork'],
  IS: ['Reykjavik'],
  IT: ['Milan', 'Rome', 'Turin', 'Bologna'],
  LV: ['Riga'],
  LI: ['Vaduz'],
  LT: ['Vilnius', 'Kaunas'],
  LU: ['Luxembourg'],
  MT: ['Valletta'],
  NO: ['Oslo', 'Bergen', 'Trondheim'],
  NL: ['Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven'],
  PL: ['Warsaw', 'Krakow', 'Wroclaw', 'Poznan'],
  PT: ['Lisbon', 'Porto'],
  CZ: ['Prague', 'Brno'],
  RO: ['Bucharest', 'Cluj-Napoca'],
  GB: ['London', 'Manchester', 'Edinburgh', 'Bristol'],
  SK: ['Bratislava', 'Kosice'],
  SI: ['Ljubljana'],
  SE: ['Stockholm', 'Gothenburg', 'Malmo'],
  CH: ['Zurich', 'Geneva', 'Basel', 'Zug'],
}
```

Every key matches a `code` in `EUROPE_COUNTRIES` (`components/search/countries.ts`) — full coverage of all 32 countries, capped at 3-5 cities each to keep the chip row readable.

## Component change

`components/search/steps/StepVilles.tsx`:
- Import `CITY_HUB_SUGGESTIONS`.
- Below each row's fields (inside the same per-row `<div>`, spanning the row), render a chip row sourced from `CITY_HUB_SUGGESTIONS[(row.pays ?? 'FR').toUpperCase()] ?? []`.
- If the list is empty (shouldn't happen given full coverage, but defensive), render nothing for that row — no placeholder, no error.
- Each chip is a small `<button type="button">` that calls `updateRow(index, { ville: city })` on click — replaces the row's `ville`, does not append/toggle.
- No filtering of already-selected cities (across rows or within the same row) — clicking a chip that matches the current value is a harmless no-op.

## Non-goals

- No domain-awareness (see Scope decision above).
- No changes to `SearchLocation`, `WizardModal`, backend, or scrapers — this is a pure onboarding UX addition, static data only.
- No live/computed "most recruiting" data from the `offers` table (rejected in favor of static curated list — confirmed with user).

## Testing

`__tests__/components/search/steps/StepVilles.test.tsx`:
- Renders city hub chips for the row's country (e.g. `pays: 'DE'` → chips include "Berlin").
- Clicking a chip calls `onChange` with that row's `ville` updated to the chip's city, other fields (`rayon_km`, `pays`) unchanged.
- Changing a row's country updates which chips are shown for that row.
