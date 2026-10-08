export interface CityHub {
  name: string
  lat: number
  lng: number
}

// Domain-agnostic: the cities that concentrate office/tech hiring in a
// country are largely the same regardless of role (data, dev, security...).
// Shown as clickable markers once a country is selected on the map.
export const CITY_HUB_SUGGESTIONS: Record<string, CityHub[]> = {
  FR: [
    { name: 'Paris', lat: 48.857, lng: 2.352 },
    { name: 'Lyon', lat: 45.764, lng: 4.836 },
    { name: 'Toulouse', lat: 43.605, lng: 1.444 },
    { name: 'Lille', lat: 50.629, lng: 3.057 },
    { name: 'Nantes', lat: 47.218, lng: -1.554 },
  ],
  DE: [
    { name: 'Berlin', lat: 52.52, lng: 13.405 },
    { name: 'Munich', lat: 48.137, lng: 11.575 },
    { name: 'Hamburg', lat: 53.551, lng: 9.994 },
    { name: 'Frankfurt', lat: 50.111, lng: 8.682 },
  ],
  AT: [
    { name: 'Vienna', lat: 48.208, lng: 16.374 },
    { name: 'Graz', lat: 47.071, lng: 15.439 },
    { name: 'Linz', lat: 48.306, lng: 14.286 },
  ],
  BE: [
    { name: 'Brussels', lat: 50.85, lng: 4.352 },
    { name: 'Antwerp', lat: 51.219, lng: 4.402 },
    { name: 'Ghent', lat: 51.054, lng: 3.717 },
  ],
  BG: [
    { name: 'Sofia', lat: 42.698, lng: 23.322 },
    { name: 'Plovdiv', lat: 42.135, lng: 24.745 },
  ],
  CY: [
    { name: 'Nicosia', lat: 35.186, lng: 33.382 },
    { name: 'Limassol', lat: 34.707, lng: 33.022 },
  ],
  HR: [
    { name: 'Zagreb', lat: 45.815, lng: 15.982 },
    { name: 'Split', lat: 43.508, lng: 16.44 },
  ],
  DK: [
    { name: 'Copenhagen', lat: 55.676, lng: 12.568 },
    { name: 'Aarhus', lat: 56.163, lng: 10.204 },
  ],
  ES: [
    { name: 'Madrid', lat: 40.417, lng: -3.704 },
    { name: 'Barcelona', lat: 41.385, lng: 2.173 },
    { name: 'Valencia', lat: 39.47, lng: -0.376 },
    { name: 'Bilbao', lat: 43.263, lng: -2.935 },
  ],
  EE: [
    { name: 'Tallinn', lat: 59.437, lng: 24.754 },
    { name: 'Tartu', lat: 58.378, lng: 26.729 },
  ],
  FI: [
    { name: 'Helsinki', lat: 60.17, lng: 24.938 },
    { name: 'Tampere', lat: 61.498, lng: 23.761 },
    { name: 'Espoo', lat: 60.205, lng: 24.652 },
  ],
  GR: [
    { name: 'Athens', lat: 37.984, lng: 23.728 },
    { name: 'Thessaloniki', lat: 40.64, lng: 22.944 },
  ],
  HU: [
    { name: 'Budapest', lat: 47.498, lng: 19.04 },
    { name: 'Debrecen', lat: 47.532, lng: 21.627 },
  ],
  IE: [
    { name: 'Dublin', lat: 53.35, lng: -6.26 },
    { name: 'Cork', lat: 51.899, lng: -8.476 },
  ],
  IS: [{ name: 'Reykjavik', lat: 64.147, lng: -21.942 }],
  IT: [
    { name: 'Milan', lat: 45.464, lng: 9.19 },
    { name: 'Rome', lat: 41.903, lng: 12.496 },
    { name: 'Turin', lat: 45.07, lng: 7.687 },
    { name: 'Bologna', lat: 44.495, lng: 11.343 },
  ],
  LV: [{ name: 'Riga', lat: 56.95, lng: 24.105 }],
  LI: [{ name: 'Vaduz', lat: 47.141, lng: 9.521 }],
  LT: [
    { name: 'Vilnius', lat: 54.687, lng: 25.28 },
    { name: 'Kaunas', lat: 54.899, lng: 23.904 },
  ],
  LU: [{ name: 'Luxembourg', lat: 49.612, lng: 6.13 }],
  MT: [{ name: 'Valletta', lat: 35.899, lng: 14.514 }],
  NO: [
    { name: 'Oslo', lat: 59.914, lng: 10.752 },
    { name: 'Bergen', lat: 60.391, lng: 5.322 },
    { name: 'Trondheim', lat: 63.431, lng: 10.395 },
  ],
  NL: [
    { name: 'Amsterdam', lat: 52.368, lng: 4.904 },
    { name: 'Rotterdam', lat: 51.924, lng: 4.478 },
    { name: 'Utrecht', lat: 52.091, lng: 5.122 },
    { name: 'Eindhoven', lat: 51.441, lng: 5.47 },
  ],
  PL: [
    { name: 'Warsaw', lat: 52.23, lng: 21.012 },
    { name: 'Krakow', lat: 50.065, lng: 19.945 },
    { name: 'Wroclaw', lat: 51.108, lng: 17.039 },
    { name: 'Poznan', lat: 52.406, lng: 16.925 },
  ],
  PT: [
    { name: 'Lisbon', lat: 38.722, lng: -9.139 },
    { name: 'Porto', lat: 41.158, lng: -8.629 },
  ],
  CZ: [
    { name: 'Prague', lat: 50.076, lng: 14.438 },
    { name: 'Brno', lat: 49.195, lng: 16.607 },
  ],
  RO: [
    { name: 'Bucharest', lat: 44.427, lng: 26.103 },
    { name: 'Cluj-Napoca', lat: 46.771, lng: 23.624 },
  ],
  GB: [
    { name: 'London', lat: 51.507, lng: -0.128 },
    { name: 'Manchester', lat: 53.481, lng: -2.243 },
    { name: 'Edinburgh', lat: 55.953, lng: -3.188 },
    { name: 'Bristol', lat: 51.455, lng: -2.588 },
  ],
  SK: [
    { name: 'Bratislava', lat: 48.149, lng: 17.107 },
    { name: 'Kosice', lat: 48.717, lng: 21.261 },
  ],
  SI: [{ name: 'Ljubljana', lat: 46.057, lng: 14.506 }],
  SE: [
    { name: 'Stockholm', lat: 59.329, lng: 18.069 },
    { name: 'Gothenburg', lat: 57.709, lng: 11.975 },
    { name: 'Malmo', lat: 55.605, lng: 13.004 },
  ],
  CH: [
    { name: 'Zurich', lat: 47.377, lng: 8.541 },
    { name: 'Geneva', lat: 46.204, lng: 6.143 },
    { name: 'Basel', lat: 47.56, lng: 7.589 },
    { name: 'Zug', lat: 47.166, lng: 8.516 },
  ],
}
