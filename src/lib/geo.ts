// Server-only country/city reference data — powers the Country/City
// dropdowns in the DNS Node add/edit form (src/components/DnsNodes/
// AddEditDnsNodeModal.tsx). NEVER import this from anything under src/ that
// Vite bundles for the browser: `country-state-city`'s underlying city
// dataset is ~8MB unpacked (all cities worldwide) — fine to hold in the
// Node process's memory (loaded lazily, once, on first use), but far too
// large to ship to a browser tab. The API below only ever sends a bounded,
// per-country slice over the wire (see server.ts's GET /api/geo/* routes).
import { Country, City } from 'country-state-city';

export interface GeoCountry {
  isoCode: string;
  name: string;
  flag: string;
}

export interface GeoCity {
  name: string;
  latitude: number;
  longitude: number;
}

// Accent/diacritic-insensitive matching — same NFD-normalize technique
// already used by slugifyVietnamese in src/db/queries.ts — so a Vietnamese
// admin typing "ha noi" or "bien hoa" (no dấu) still finds "Hà Nội" / "Biên
// Hòa", and the same holds for other accented scripts (é, ü, ñ, ...).
function normalizeForSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

let countriesCache: GeoCountry[] | null = null;

export function listCountries(): GeoCountry[] {
  if (!countriesCache) {
    countriesCache = Country.getAllCountries()
      .map((c) => ({ isoCode: c.isoCode, name: c.name, flag: c.flag }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return countriesCache;
}

// Some countries (the US alone has ~19,800 entries in this dataset) are far
// too large to ever send whole — always bounded, and `search` narrows it
// server-side rather than shipping the full per-country list for the client
// to filter locally.
const CITY_RESULT_LIMIT = 50;

export function searchCities(countryIsoCode: string, search: string = ''): GeoCity[] {
  if (!countryIsoCode) return [];
  const all = City.getCitiesOfCountry(countryIsoCode) || [];
  const needle = normalizeForSearch(search.trim());

  const matches = needle ? all.filter((c) => normalizeForSearch(c.name).includes(needle)) : all;

  return matches
    .filter((c) => c.latitude != null && c.longitude != null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, CITY_RESULT_LIMIT)
    .map((c) => ({ name: c.name, latitude: Number(c.latitude), longitude: Number(c.longitude) }));
}
