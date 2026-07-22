import { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '@/lib/css';

/**
 * Full-screen product photo viewer with zoom.
 *
 * Buyers judge fabric, zari and embroidery from the photo, so the product page
 * needs a real close-up rather than a card-sized crop. This opens over the page
 * and supports every gesture people try:
 *
 *  - the +/− buttons, and the keyboard's `+` / `-`
 *  - double-click / double-tap to jump between fit and 2.5×
 *  - the scroll wheel (and trackpad pinch, which browsers report as ctrl+wheel)
 *  - drag to pan once zoomed in; arrows / swipe to change photo when zoomed out
 *  - Escape, the close button, or clicking the backdrop to leave
 */

const MIN = 1;
const MAX = 4;
const STEP = 0.5;

export function ImageZoom({
  images,
  index,
  title,
  onClose,
  onIndexChange,
}: {
  images: string[];
  index: number;
  title: string;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const zoomed = scale > 1;

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Changing photo always returns to a fit view — staying zoomed would drop the
  // buyer into a random corner of the next image.
  const go = useCallback(
    (i: number) => {
      if (i < 0 || i >= images.length) return;
      reset();
      onIndexChange(i);
    },
    [images.length, onIndexChange, reset],
  );

  const zoomTo = useCallback((next: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, Math.round(next * 10) / 10));
    setScale(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  }, []);

  // Lock the page behind the viewer so scrolling zooms/pans here, not there.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomTo(scale + STEP);
      else if (e.key === '-' || e.key === '_') zoomTo(scale - STEP);
      else if (e.key === '0') reset();
      else if (e.key === 'ArrowLeft' && !zoomed) go(index - 1);
      else if (e.key === 'ArrowRight' && !zoomed) go(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoomTo, scale, reset, zoomed, go, index]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomTo(scale + (e.deltaY < 0 ? STEP : -STEP));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!zoomed) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const onPointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const src = images[index] ?? images[0];
  const pct = Math.round(scale * 100);

  const ctlStyle = (disabled = false) =>
    css(
      `width:44px;height:44px;flex:none;border:none;border-radius:14px;background:rgba(255,255,255,.14);` +
        `color:#fff;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? 0.35 : 1};` +
        'display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);',
    );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — photo viewer`}
      onClick={onClose}
      style={css('position:fixed;inset:0;z-index:1200;background:rgba(20,8,14,.96);display:flex;flex-direction:column;animation:agx-fade .2s ease;')}
    >
      {/* Top bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={css('flex:none;display:flex;align-items:center;gap:12px;padding:14px clamp(12px,3vw,24px);color:#fff;')}
      >
        <div style={css('flex:1;min-width:0;')}>
          <div style={css('font-weight:800;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;')}>{title}</div>
          <div style={css("font-family:'IBM Plex Mono',monospace;font-size:11px;opacity:.65;margin-top:2px;")}>
            Photo {index + 1} of {images.length} · {pct}%
          </div>
        </div>
        <button onClick={onClose} aria-label="Close viewer" style={ctlStyle()}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:24px;")}>close</span>
        </button>
      </div>

      {/* Stage */}
      <div
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onDoubleClick={() => (zoomed ? reset() : zoomTo(2.5))}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={css(
          `flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;` +
            `touch-action:${zoomed ? 'none' : 'pan-y'};cursor:${zoomed ? (dragging ? 'grabbing' : 'grab') : 'zoom-in'};`,
        )}
      >
        <img
          src={src}
          alt={`${title} — photo ${index + 1}`}
          draggable={false}
          style={css(
            `max-width:100%;max-height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none;` +
              `transform:translate(${offset.x}px,${offset.y}px) scale(${scale});transform-origin:center center;` +
              // Easing a zoom step looks good; easing a drag makes the photo
              // lag behind the finger, so the transition is dropped while panning.
              `transition:${dragging ? 'none' : 'transform .18s cubic-bezier(.2,.7,.2,1)'};`,
          )}
        />

        {/* Photo stepping, only while fit — panning owns the drag when zoomed. */}
        {images.length > 1 && !zoomed && (
          <>
            {index > 0 && (
              <button onClick={() => go(index - 1)} aria-label="Previous photo" style={{ ...ctlStyle(), ...css('position:absolute;left:clamp(8px,2vw,20px);top:50%;transform:translateY(-50%);') }}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:24px;")}>chevron_left</span>
              </button>
            )}
            {index < images.length - 1 && (
              <button onClick={() => go(index + 1)} aria-label="Next photo" style={{ ...ctlStyle(), ...css('position:absolute;right:clamp(8px,2vw,20px);top:50%;transform:translateY(-50%);') }}>
                <span style={css("font-family:'Material Symbols Outlined';font-size:24px;")}>chevron_right</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Zoom controls */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={css('flex:none;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px clamp(12px,3vw,24px) calc(18px + env(safe-area-inset-bottom));')}
      >
        <button onClick={() => zoomTo(scale - STEP)} disabled={scale <= MIN} aria-label="Zoom out" style={ctlStyle(scale <= MIN)}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:24px;")}>zoom_out</span>
        </button>
        <button
          onClick={reset}
          disabled={!zoomed}
          style={css(`height:44px;padding:0 18px;border:none;border-radius:14px;background:rgba(255,255,255,.14);color:#fff;font-weight:800;font-size:13px;cursor:${zoomed ? 'pointer' : 'default'};opacity:${zoomed ? 1 : 0.5};backdrop-filter:blur(8px);`)}
        >
          {pct}%
        </button>
        <button onClick={() => zoomTo(scale + STEP)} disabled={scale >= MAX} aria-label="Zoom in" style={ctlStyle(scale >= MAX)}>
          <span style={css("font-family:'Material Symbols Outlined';font-size:24px;")}>zoom_in</span>
        </button>
      </div>
    </div>
  );
}
