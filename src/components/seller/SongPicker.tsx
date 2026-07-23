import { useEffect, useRef, useState } from 'react';
import { css } from '@/lib/css';
import { searchMusic, trackCredit, type MusicTrack } from '@/lib/musicSearch';

/**
 * "Add a song" for a product — the Instagram move: type a track, preview it,
 * tap to attach it. The chosen track's 30-second preview URL and its credit
 * line are handed back to the form; the buyer feed plays the first 15 seconds.
 *
 * Kept self-contained: it owns the search box, the results, and a single shared
 * preview player (one clip audible at a time), so the ProductForm just wires a
 * value in and gets `{ url, title }` back.
 */
export function SongPicker({
  url,
  title,
  onChange,
}: {
  url: string;
  title: string;
  onChange: (next: { url: string; title: string }) => void;
}) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Debounced search. Each keystroke cancels the last request, so the results
  // always match the latest term and a slow response can't overwrite a newer one.
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); setError(null); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchMusic(q, ctrl.signal)
        .then((rows) => { setResults(rows); setError(null); })
        .catch((e: unknown) => { if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed'); })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [term]);

  // One shared preview element, torn down on unmount so nothing keeps playing
  // after the form closes.
  useEffect(() => () => { audioRef.current?.pause(); audioRef.current = null; }, []);

  const togglePreview = (t: MusicTrack) => {
    if (previewing === t.id) {
      audioRef.current?.pause();
      setPreviewing(null);
      return;
    }
    audioRef.current?.pause();
    const a = new Audio(t.previewUrl);
    a.onended = () => setPreviewing(null);
    audioRef.current = a;
    void a.play().catch(() => setPreviewing(null));
    setPreviewing(t.id);
  };

  const pick = (t: MusicTrack) => {
    audioRef.current?.pause();
    setPreviewing(null);
    onChange({ url: t.previewUrl, title: trackCredit(t) });
    setTerm('');
    setResults([]);
  };

  const clear = () => {
    audioRef.current?.pause();
    setPreviewing(null);
    onChange({ url: '', title: '' });
  };

  // ── Already chosen ──
  if (url) {
    return (
      <div style={css('margin-top:8px;border:1.5px solid #F0D8E2;background:#FFF7FA;border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:11px;')}>
        <span style={css('flex:none;width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#D6336C,#B02454);display:flex;align-items:center;justify-content:center;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:21px;")}>music_note</span>
        </span>
        <span style={css('flex:1;min-width:0;')}>
          <span style={css('display:block;font-size:13.5px;font-weight:800;color:#241019;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{title || 'Song added'}</span>
          <span style={css('display:block;font-size:11.5px;font-weight:700;color:#8A7078;margin-top:1px;')}>Plays on this piece in the buyer feed · first 15s</span>
        </span>
        <button type="button" onClick={clear} aria-label="Remove song" style={css('flex:none;border:none;background:none;cursor:pointer;padding:4px;')}>
          <span style={css("font-family:'Material Symbols Outlined';color:#B02454;font-size:21px;")}>delete</span>
        </button>
      </div>
    );
  }

  // ── Search + results ──
  return (
    <div style={css('margin-top:8px;')}>
      <div style={css('position:relative;')}>
        <span style={css("position:absolute;left:13px;top:50%;transform:translateY(-50%);font-family:'Material Symbols Outlined';color:#B79AA6;font-size:20px;pointer-events:none;")}>search</span>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search a song or artist…"
          style={css('width:100%;border:1.5px solid #F0D8E2;background:#fff;border-radius:13px;padding:0 14px 0 40px;height:50px;font-size:14px;font-weight:600;')}
        />
        {loading && (
          <span style={css("position:absolute;right:13px;top:50%;transform:translateY(-50%);font-family:'Material Symbols Outlined';color:#D6336C;font-size:20px;animation:agx-spin 1s linear infinite;")}>progress_activity</span>
        )}
      </div>

      {error && <div style={css('margin-top:8px;font-size:12px;font-weight:700;color:#D6455A;')}>{error}</div>}

      {results.length > 0 && (
        <div style={css('margin-top:8px;border:1.5px solid #F0D8E2;border-radius:14px;overflow:hidden;max-height:280px;overflow-y:auto;')}>
          {results.map((t, i) => {
            const on = previewing === t.id;
            return (
              <div
                key={t.id}
                style={css(`display:flex;align-items:center;gap:10px;padding:9px 11px;cursor:pointer;background:#fff;${i > 0 ? 'border-top:1px solid #F6E7EE;' : ''}`)}
              >
                <button
                  type="button"
                  onClick={() => togglePreview(t)}
                  aria-label={on ? 'Stop preview' : 'Preview'}
                  style={css('flex:none;width:42px;height:42px;border-radius:10px;border:none;padding:0;position:relative;overflow:hidden;cursor:pointer;background:#F3E4EC;')}
                >
                  {t.artwork
                    ? <img src={t.artwork} alt="" style={css('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;')} />
                    : null}
                  <span style={css(`position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(36,16,25,${on ? '.42' : '.28'});`)}>
                    <span style={css("font-family:'Material Symbols Outlined';color:#fff;font-size:22px;")}>{on ? 'pause' : 'play_arrow'}</span>
                  </span>
                </button>
                <button type="button" onClick={() => pick(t)} style={css('flex:1;min-width:0;text-align:left;border:none;background:none;padding:0;cursor:pointer;')}>
                  <span style={css('display:block;font-size:13.5px;font-weight:800;color:#241019;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{t.title}</span>
                  <span style={css('display:block;font-size:11.5px;font-weight:700;color:#8A7078;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;')}>{t.artist}</span>
                </button>
                <button type="button" onClick={() => pick(t)} aria-label="Add this song" style={css('flex:none;height:32px;padding:0 13px;border:1.5px solid #D6336C;border-radius:999px;background:#fff;color:#B02454;font-size:12px;font-weight:800;cursor:pointer;')}>Add</button>
              </div>
            );
          })}
        </div>
      )}

      {term.trim().length >= 2 && !loading && !error && results.length === 0 && (
        <div style={css('margin-top:8px;font-size:12.5px;font-weight:600;color:#8A7078;')}>No songs found — try another search.</div>
      )}
    </div>
  );
}
