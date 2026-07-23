/**
 * Resolve a human-readable location label for the current visitor, best-first:
 *
 *   1. Browser GPS (navigator.geolocation) → reverse-geocoded to the actual
 *      *area* (locality/neighbourhood), e.g. "T. Nagar, Chennai, Tamil Nadu, IN".
 *      This is the only source accurate to where the user really is. It asks the
 *      visitor for permission; if they allow it we get a real area.
 *   2. IP fallback (/api/geo) — region-level and often the wrong city, used only
 *      when GPS is unavailable, denied, or times out.
 *
 * Everything is best-effort; a total failure resolves to '' (location unknown).
 */

const GPS_TIMEOUT_MS = 9000;
const GEOCODE_TIMEOUT_MS = 4000;

/** Promisified getCurrentPosition — resolves null instead of throwing. */
function currentPosition(): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null), // denied / unavailable / timeout
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: 10 * 60_000 },
    );
  });
}

function dedupeLabel(parts: (string | undefined | null)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const v = (raw ?? '').trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.join(', ');
}

/**
 * Reverse-geocode coordinates to an area label via BigDataCloud's free
 * client endpoint (no key, HTTPS, generous client-side use).
 */
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return '';
    const d = await res.json();
    // locality = neighbourhood/area, city = town, principalSubdivision = state.
    return dedupeLabel([d?.locality, d?.city, d?.principalSubdivision, d?.countryCode]);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

/** IP-based fallback via our own serverless endpoint. */
async function ipLocation(): Promise<string> {
  try {
    const res = await fetch('/api/geo');
    if (!res.ok) return '';
    const d = await res.json();
    return typeof d?.label === 'string' ? d.label : '';
  } catch {
    return '';
  }
}

/**
 * Best available location label. Tries GPS first (real area), then IP.
 * Never rejects — returns '' when nothing could be resolved.
 */
export async function resolveLocation(): Promise<string> {
  const pos = await currentPosition();
  if (pos) {
    const area = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    if (area) return area;
  }
  return ipLocation();
}
