/**
 * "Mark shipped" — the form that replaced a one-tap status change.
 *
 * Tracking is mandatory to ship, and that rule lives in the database (migration
 * 0063's trg_orders_require_shipment), not here. This sheet exists so the seller
 * meets the rule comfortably rather than hitting it as an error; if it is ever
 * bypassed, the transition still fails.
 *
 * The tracking link is prefilled from the chosen courier's template and stays
 * editable. Most Indian courier tracking pages are form-POST with no addressable
 * URL, so many couriers have no template at all — the seller can paste the link
 * their courier gave them instead, and a parcel with no link still ships (the
 * buyer sees courier + AWB, which beats a dead URL).
 *
 * When Shiprocket is available for the shop (migration 0067) the sheet opens on
 * a booking mode instead: we create the parcel, a courier is assigned and the
 * AWB comes back, so the seller types nothing. Manual entry stays one tap away
 * and is the ONLY mode on a COD order — Shiprocket's COD remittance would pay
 * the platform rather than the seller, which is not the arrangement.
 */
import { useEffect, useMemo, useState } from 'react';
import { css } from '@/lib/css';
import { buildTrackingUrl, type Courier } from '@/data/shipments';

const OTHER = '__other__';

/** The pickup slots DTDC offers (two-hour windows). Shown to the seller so they
 *  choose when the courier collects, matching the "Schedule for Pickup" screen. */
const PICKUP_SLOTS: { start: string; end: string }[] = [
  { start: '12:00', end: '14:00' },
  { start: '14:00', end: '16:00' },
  { start: '16:00', end: '18:00' },
  { start: '18:00', end: '20:00' },
  { start: '20:00', end: '22:00' },
  { start: '22:00', end: '23:59' },
];
const todayISO = () => new Date().toISOString().slice(0, 10);

export type BookPayload = { carrier: string; date: string; slotStart: string; slotEnd: string };

export function ShipSheet({
  couriers,
  busy,
  canBook = false,
  bookCarriers = [],
  onCancel,
  onConfirm,
  onBook,
}: {
  couriers: Courier[];
  busy: boolean;
  /** A courier the shop can book on is switched on, and this order is prepaid. */
  canBook?: boolean;
  /** The carriers the seller may choose from for a booked parcel, most-preferred
   *  first (DTDC leads). Empty falls back to a single automatic booking. */
  bookCarriers?: { id: string; label: string }[];
  onCancel: () => void;
  onConfirm: (v: { courierId: string | null; courierName: string; awb: string; trackingUrl: string | null }) => void;
  onBook?: (payload: BookPayload) => void;
}) {
  // Booking is the default when it is available: it is fewer taps, and the AWB
  // it produces is one a courier scan can drive, which is what eventually
  // settles the seller's payout without anyone self-attesting delivery.
  const [mode, setMode] = useState<'book' | 'manual'>(canBook ? 'book' : 'manual');
  const [courierKey, setCourierKey] = useState('');
  const [otherName, setOtherName] = useState('');
  const [awb, setAwb] = useState('');
  const [link, setLink] = useState('');
  // Once the seller edits the link themselves we stop overwriting it, or typing
  // the AWB would wipe what they pasted.
  const [linkTouched, setLinkTouched] = useState(false);
  // Booking mode: the seller chooses the courier and schedules the pickup.
  const [carrier, setCarrier] = useState(bookCarriers[0]?.id ?? '');
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [slotIdx, setSlotIdx] = useState(0);

  const courier = useMemo(() => couriers.find((c) => c.id === courierKey), [couriers, courierKey]);
  const isOther = courierKey === OTHER;
  const autoLink = useMemo(() => buildTrackingUrl(courier?.tracking_url_template, awb), [courier, awb]);

  useEffect(() => {
    if (!linkTouched) setLink(autoLink ?? '');
  }, [autoLink, linkTouched]);

  const courierName = isOther ? otherName.trim() : (courier?.name ?? '');
  const ready = courierName.length > 0 && awb.trim().length > 0 && !busy;

  const field = 'width:100%;height:46px;border-radius:12px;border:1.5px solid var(--ag-border);background:var(--ag-bg);color:var(--ag-ink);padding:0 13px;font-size:14px;font-family:inherit;box-sizing:border-box;';
  const label = 'font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;margin-bottom:6px;';

  return (
    <div
      style={css('position:fixed;inset:0;z-index:60;background:rgba(20,8,14,.45);display:flex;align-items:flex-end;justify-content:center;')}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={css('width:100%;max-width:520px;background:var(--ag-surface);border-radius:20px 20px 0 0;padding:18px 20px 22px;box-shadow:0 -12px 40px -18px rgba(107,20,54,.6);max-height:88vh;overflow-y:auto;')}
      >
        <div style={css("font-weight:700;font-size:20px;")}>Ship this order</div>
        <div style={css('font-size:12.5px;color:var(--ag-muted);margin-top:3px;line-height:1.5;')}>
          The courier and tracking number are required — they are what the customer follows, and what proves the parcel left your shop.
        </div>

        {canBook && (
          <div style={css('display:flex;gap:8px;margin-top:16px;')}>
            {([['book', 'Book a courier'], ['manual', 'I shipped it myself']] as const).map(([key, text]) => {
              const on = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  style={css(`flex:1;height:42px;border-radius:12px;border:1.5px solid ${on ? '#D6336C' : 'var(--ag-border)'};background:${on ? 'var(--ag-surface-2)' : 'var(--ag-surface)'};color:${on ? 'var(--ag-crimson)' : 'var(--ag-ink-2)'};font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;`)}
                >
                  {text}
                </button>
              );
            })}
          </div>
        )}

        {mode === 'book' ? (
          <>
            {bookCarriers.length > 0 && (
              <div style={css('margin-top:16px;')}>
                <div style={css(label)}>COURIER</div>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)} style={css(field)}>
                  {bookCarriers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            )}

            <div style={css('display:flex;gap:10px;margin-top:12px;')}>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css(label)}>PICKUP DATE</div>
                <input
                  type="date"
                  value={pickupDate}
                  min={todayISO()}
                  onChange={(e) => setPickupDate(e.target.value)}
                  style={css(field)}
                />
              </div>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css(label)}>TIME SLOT</div>
                <select value={slotIdx} onChange={(e) => setSlotIdx(Number(e.target.value))} style={css(field)}>
                  {PICKUP_SLOTS.map((s, i) => <option key={i} value={i}>{s.start} – {s.end}</option>)}
                </select>
              </div>
            </div>

            <div style={css('margin-top:14px;background:var(--ag-surface-2);border:1px solid var(--ag-border);border-radius:14px;padding:13px 14px;')}>
              <div style={css('font-size:12.5px;color:var(--ag-muted);line-height:1.55;')}>
                The courier is asked to collect from your shop address in this slot, the tracking number comes
                back straight away, and the label is saved for you to print. The weight comes from your products
                — set it on each item so the declared weight matches what the courier weighs.
              </div>
            </div>

            <div style={css('display:flex;gap:10px;margin-top:18px;')}>
              <button
                onClick={onCancel}
                style={css('flex:1;height:50px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-label);border-radius:13px;font-weight:800;cursor:pointer;font-family:inherit;')}
              >
                Cancel
              </button>
              <button
                disabled={busy || !carrier}
                onClick={() => onBook?.({ carrier, date: pickupDate, slotStart: PICKUP_SLOTS[slotIdx].start, slotEnd: PICKUP_SLOTS[slotIdx].end })}
                style={css(`flex:1.4;height:50px;border:none;border-radius:13px;background:${busy || !carrier ? 'var(--ag-surface-2)' : 'linear-gradient(135deg,#D6336C,#B02454)'};color:${busy || !carrier ? 'var(--ag-muted)' : '#fff'};font-weight:800;cursor:${busy || !carrier ? 'default' : 'pointer'};font-family:inherit;`)}
              >
                {busy ? 'Scheduling…' : 'Schedule & ship'}
              </button>
            </div>
          </>
        ) : (
        <>
        <div style={css('margin-top:16px;')}>
          <div style={css(label)}>COURIER</div>
          <select
            value={courierKey}
            onChange={(e) => { setCourierKey(e.target.value); setLinkTouched(false); }}
            style={css(field)}
          >
            <option value="">Select a courier…</option>
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value={OTHER}>Other courier…</option>
          </select>
        </div>

        {isOther && (
          <div style={css('margin-top:12px;')}>
            <div style={css(label)}>COURIER NAME</div>
            <input
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              placeholder="e.g. Sri Balaji Couriers"
              style={css(field)}
            />
          </div>
        )}

        <div style={css('margin-top:12px;')}>
          <div style={css(label)}>TRACKING / DOCKET NUMBER</div>
          <input
            value={awb}
            onChange={(e) => setAwb(e.target.value)}
            placeholder="e.g. 1234567890123"
            autoCapitalize="characters"
            style={css(field)}
          />
        </div>

        <div style={css('margin-top:12px;')}>
          <div style={css(label)}>TRACKING LINK · OPTIONAL</div>
          <input
            value={link}
            onChange={(e) => { setLink(e.target.value); setLinkTouched(true); }}
            placeholder="Paste the link your courier gave you"
            style={css(field)}
          />
          <div style={css('font-size:12px;color:var(--ag-muted);margin-top:6px;line-height:1.5;')}>
            {autoLink && !linkTouched
              ? 'Filled in from the courier’s tracking page — edit it if it doesn’t open.'
              : 'Leave blank if your courier has no tracking page. The customer still sees the courier and docket number.'}
          </div>
        </div>

        <div style={css('display:flex;gap:10px;margin-top:20px;')}>
          <button
            onClick={onCancel}
            style={css('flex:1;height:50px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-label);border-radius:13px;font-weight:800;cursor:pointer;font-family:inherit;')}
          >
            Cancel
          </button>
          <button
            disabled={!ready}
            onClick={() => onConfirm({
              courierId: isOther ? null : (courier?.id ?? null),
              courierName,
              awb: awb.trim(),
              trackingUrl: link.trim() || null,
            })}
            style={css(`flex:1.4;height:50px;border:none;border-radius:13px;background:${ready ? 'linear-gradient(135deg,#D6336C,#B02454)' : 'var(--ag-surface-2)'};color:${ready ? '#fff' : 'var(--ag-muted)'};font-weight:800;cursor:${ready ? 'pointer' : 'default'};font-family:inherit;`)}
          >
            {busy ? 'Shipping…' : 'Ship order'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
