import { enforceRateLimit } from './_rateLimit.js';

/**
 * Vercel serverless function: approximate, IP-based location of the caller.
 *
 * Used by the live-presence tracker so the admin's "who's online now" roster can
 * show roughly where each visitor is (e.g. "Chennai, TN, IN") without ever asking
 * the browser for its GPS permission.
 *
 * Two sources, best-first:
 *   1. Vercel's own edge geo headers — free and instant, but in practice they
 *      often carry only the COUNTRY (x-vercel-ip-city / -country-region come back
 *      empty on many plans/IPs), which is why "IN" was all that showed.
 *   2. A free IP→city lookup (ipwho.is: HTTPS, no key, no signup) using the real
 *      client IP, to fill in the city/region the edge left blank.
 *
 * Everything is best-effort and city-level at most. A failure or an unknown IP
 * yields an empty label, which the caller shows as nothing.
 */

// Vercel URL-encodes city/region names that contain spaces or non-ASCII.
function header(req, name) {
  const raw = req.headers?.[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string' || !v.trim()) return '';
  try {
    return decodeURIComponent(v).trim();
  } catch {
    return v.trim();
  }
}

/** The caller's real public IP, from the proxy chain Vercel sets. */
function clientIp(req) {
  const fwd = header(req, 'x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return header(req, 'x-real-ip') || (req.socket?.remoteAddress ?? '');
}

// Private/loopback ranges never resolve to a public location (local dev, LAN).
function isPublicIp(ip) {
  if (!ip) return false;
  if (ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')) return false;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return false;
  return true;
}

/**
 * City-level lookup via ipwho.is. Short timeout so a slow/rate-limited provider
 * never holds the presence tracker up — we fall back to whatever the edge gave.
 */
async function lookupCity(ip) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country_code`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d || d.success === false) return null;
    return {
      city: typeof d.city === 'string' ? d.city.trim() : '',
      region: typeof d.region === 'string' ? d.region.trim() : '',
      country: typeof d.country_code === 'string' ? d.country_code.trim() : '',
    };
  } catch {
    return null; // timeout / network / bad JSON — silently fall back
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { key: 'geo', limit: 60, windowMs: 60_000 }))) return;

  // Start from the edge headers.
  let city = header(req, 'x-vercel-ip-city');
  let region = header(req, 'x-vercel-ip-country-region');
  let country = header(req, 'x-vercel-ip-country');

  // If the edge only gave a country (or nothing), enrich with a real lookup.
  if (!city) {
    const ip = clientIp(req);
    if (isPublicIp(ip)) {
      const geo = await lookupCity(ip);
      if (geo) {
        city = geo.city || city;
        region = geo.region || region;
        country = geo.country || country;
      }
    }
  }

  // A single human-readable label, most-specific first, skipping blanks:
  // "Chennai, Tamil Nadu, IN" — or "" when the IP couldn't be placed.
  const label = [city, region, country].filter(Boolean).join(', ');

  // Location changes very slowly per visitor; let the browser cache it briefly so
  // a tab that navigates a lot doesn't re-hit this on every page.
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).json({ city, region, country, label });
}
