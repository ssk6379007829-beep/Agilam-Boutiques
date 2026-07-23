import { enforceRateLimit } from './_rateLimit.js';

/**
 * Vercel serverless function: approximate, IP-based location of the caller.
 *
 * Used by the live-presence tracker so the admin's "who's online now" roster can
 * show roughly where each visitor is (e.g. "Chennai, TN, IN") without ever asking
 * the browser for its GPS permission. Vercel resolves the caller's IP to a coarse
 * location at the edge and hands it to us as request headers — no external
 * geo-IP service, no API key, and nothing more precise than a city.
 *
 * Values are city-level only and can be missing (unknown IP, local dev). The
 * caller treats an empty result as "location unknown" and shows nothing.
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(req, res, { key: 'geo', limit: 60, windowMs: 60_000 }))) return;

  const city = header(req, 'x-vercel-ip-city');
  const region = header(req, 'x-vercel-ip-country-region');
  const country = header(req, 'x-vercel-ip-country');

  // A single human-readable label, most-specific first, skipping blanks:
  // "Chennai, TN, IN" — or "" when the edge couldn't place the IP.
  const label = [city, region, country].filter(Boolean).join(', ');

  // Location changes very slowly per visitor; let the browser cache it briefly so
  // a tab that navigates a lot doesn't re-hit this on every page.
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.status(200).json({ city, region, country, label });
}
