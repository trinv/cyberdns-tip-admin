// Server-only country/province reference data — powers the Country/
// Province dropdowns in the DNS Node add/edit form (src/components/
// DnsNodes/AddEditDnsNodeModal.tsx). NEVER import this from anything under
// src/ that Vite bundles for the browser: `country-state-city`'s underlying
// datasets are several MB unpacked — fine to hold in the Node process's
// memory (loaded lazily, once, on first use), but far too large to ship to
// a browser tab. The API below only ever sends a small, bounded,
// per-country slice over the wire (see server.ts's GET /api/geo/* routes).
//
// Uses STATE-level data (province/tỉnh-thành), not city-level: this
// package's "city" list is inconsistent for at least Vietnam (mixes
// district/ward-level entries like "Huyện Bắc Hà" with English names for
// major cities like "Hanoi" instead of "Hà Nội") and is unusably large for
// big countries (~19,800 rows for the US alone). State-level is the
// standard 63-tỉnh/thành list for Vietnam, properly named with diacritics,
// and every country's state list is small enough (largest is France at
// ~123) to send whole — no search/pagination needed.
import { Country, State } from 'country-state-city';

export interface GeoCountry {
  isoCode: string;
  name: string;
  flag: string;
}

export interface GeoProvince {
  name: string;
  latitude: number;
  longitude: number;
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

// A handful of small nations/territories (~53 of 250) have zero states in
// this dataset — callers (see AddEditDnsNodeModal.tsx) handle an empty
// result by falling back to manual lat/lng entry rather than showing a
// broken empty dropdown.
export function listProvincesForCountry(countryIsoCode: string): GeoProvince[] {
  if (!countryIsoCode) return [];
  return State.getStatesOfCountry(countryIsoCode)
    .filter((s) => s.latitude != null && s.latitude !== '' && s.longitude != null && s.longitude !== '')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ name: s.name, latitude: Number(s.latitude), longitude: Number(s.longitude) }));
}
