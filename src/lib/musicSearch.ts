/**
 * Online music search for the Inspire-feed song, Instagram-style: the seller
 * types a song, picks one, and its short preview clip becomes the product's
 * feed track.
 *
 * Backed by Apple's public iTunes Search API — no key, browser-callable (it
 * echoes the request Origin back in `Access-Control-Allow-Origin`), and every
 * hit carries a ~30-second `previewUrl` we can stream directly. The feed caps
 * playback at 15 seconds, so only the opening of the preview is ever heard.
 */

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  /** ~30s preview clip (m4a on Apple's CDN); played cross-origin in an <audio>. */
  previewUrl: string;
  artwork: string;
};

/** The credit line stored on the product and shown in the card's music pill. */
export function trackCredit(t: { title: string; artist: string }): string {
  return t.artist ? `${t.title} · ${t.artist}` : t.title;
}

type ItunesRow = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
};

/** Search songs by name/artist. Returns only tracks that carry a preview. */
export async function searchMusic(term: string, signal?: AbortSignal): Promise<MusicTrack[]> {
  const q = term.trim();
  if (!q) return [];

  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=24`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Music search is unavailable right now');

  // The API replies as text/javascript, but the body is JSON either way.
  const data = (await res.json()) as { results?: ItunesRow[] };
  const rows = Array.isArray(data.results) ? data.results : [];

  return rows
    .filter((r): r is ItunesRow & { previewUrl: string } => typeof r.previewUrl === 'string' && r.previewUrl.length > 0)
    .map((r) => ({
      id: String(r.trackId ?? `${r.artistName}-${r.trackName}`),
      title: r.trackName ?? 'Unknown track',
      artist: r.artistName ?? '',
      previewUrl: r.previewUrl,
      // Bump the thumbnail to a crisper size than the default 100px.
      artwork: (r.artworkUrl100 ?? r.artworkUrl60 ?? '').replace('100x100', '160x160'),
    }));
}
