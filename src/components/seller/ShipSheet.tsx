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

/** The shop's pickup address, confirmed (and editable) before every booking.
 *  Prefilled from the shop profile; an edit is saved back to it. */
export type PickupInfo = { phone: string; addressLine: string; city: string; state: string; pincode: string };

export type BookPayload = {
  carrier: string;
  /** Shiprocket courier_company_id when a specific courier was picked. */
  courierId?: string;
  date: string; slotStart: string; slotEnd: string;
  /** The pickup address the parcel is collected from, as confirmed in the sheet. */
  pickup: PickupInfo;
};

/** One bookable courier in the picker. DTDC (our contracted account) has no
 *  live rate; each Shiprocket courier carries its live rate (the platform's
 *  cost) and ETA. */
export type CourierOption = {
  key: string;
  provider: 'dtdc' | 'shiprocket' | 'shadowfax';
  courierId?: string;
  label: string;
  rate: number | null;
  days: string | null;
};

export function ShipSheet({
  couriers,
  busy,
  canBook = false,
  courierOptions = [],
  pickup,
  onCancel,
  onConfirm,
  onBook,
}: {
  couriers: Courier[];
  busy: boolean;
  /** A courier the shop can book on is switched on, and this order is prepaid. */
  canBook?: boolean;
  /** The couriers the seller may pick from, DTDC first then Shiprocket couriers
   *  cheapest-first. Empty falls back to the manual form. */
  courierOptions?: CourierOption[];
  /** The shop's saved pickup address, prefilled into the booking form. */
  pickup?: PickupInfo;
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
  // Booking mode: the seller picks a courier (card) and schedules the pickup.
  // DTDC is first in the list and the default; the seller can switch to any
  // Shiprocket courier. Re-synced if the options arrive/refresh after mount.
  const [selectedKey, setSelectedKey] = useState(courierOptions[0]?.key ?? '');
  useEffect(() => {
    if (courierOptions.length && !courierOptions.some((c) => c.key === selectedKey)) {
      setSelectedKey(courierOptions[0].key);
    }
  }, [courierOptions, selectedKey]);
  const selected = courierOptions.find((c) => c.key === selectedKey) ?? null;
  // The lowest live rate across the options — tagged "Cheapest" in the list.
  const cheapestKey = useMemo(() => {
    const priced = courierOptions.filter((c) => c.rate != null);
    if (!priced.length) return null;
    return priced.reduce((a, b) => ((b.rate ?? Infinity) < (a.rate ?? Infinity) ? b : a)).key;
  }, [courierOptions]);
  const [pickupDate, setPickupDate] = useState(todayISO());
  const [slotIdx, setSlotIdx] = useState(0);
  // The pickup address the courier collects from — prefilled from the shop and
  // editable here (an edit is saved back to the shop profile). The shop phone
  // is often blank, which is why the label has printed 0000000000; collecting
  // it here fixes that at the point it matters.
  const [editPickup, setEditPickup] = useState(false);
  const [puPhone, setPuPhone] = useState('');
  const [puAddress, setPuAddress] = useState('');
  const [puCity, setPuCity] = useState('');
  const [puState, setPuState] = useState('');
  const [puPin, setPuPin] = useState('');
  useEffect(() => {
    setPuPhone(pickup?.phone ?? '');
    setPuAddress(pickup?.addressLine ?? '');
    setPuCity(pickup?.city ?? '');
    setPuState(pickup?.state ?? '');
    setPuPin(pickup?.pincode ?? '');
  }, [pickup]);
  const pin6 = puPin.replace(/\D/g, '').length === 6;
  const phone10 = puPhone.replace(/\D/g, '').length >= 10;
  const pickupReady = puAddress.trim().length > 0 && pin6 && phone10;

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
            {courierOptions.length > 0 && (
              <div style={css('margin-top:16px;')}>
                <div style={css(label)}>CHOOSE A COURIER</div>
                {/* A card per courier. DTDC (our account) is first and the
                    default; each Shiprocket courier shows its live rate (the
                    platform's cost) and ETA, cheapest tagged. The seller taps to
                    pick. */}
                <div style={css('display:flex;flex-direction:column;gap:8px;')}>
                  {courierOptions.map((c) => {
                    const on = c.key === selectedKey;
                    const isCheapest = c.key === cheapestKey;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setSelectedKey(c.key)}
                        style={css(`display:flex;align-items:center;gap:11px;text-align:left;padding:12px 13px;border-radius:13px;border:1.5px solid ${on ? '#D6336C' : 'var(--ag-border)'};background:${on ? 'var(--ag-surface-2)' : 'var(--ag-surface)'};cursor:pointer;font-family:inherit;`)}
                      >
                        <span style={css(`width:18px;height:18px;flex:none;border-radius:50%;border:2px solid ${on ? 'var(--ag-crimson)' : 'var(--ag-border)'};display:flex;align-items:center;justify-content:center;`)}>
                          {on && <span style={css('width:8px;height:8px;border-radius:50%;background:var(--ag-crimson);')} />}
                        </span>
                        <div style={css('flex:1;min-width:0;')}>
                          <div style={css('display:flex;align-items:center;gap:7px;flex-wrap:wrap;')}>
                            <span style={css('font-weight:800;font-size:13.5px;color:var(--ag-ink);')}>{c.label}</span>
                            {c.provider === 'dtdc' && (
                              <span style={css('font-size:10px;font-weight:800;color:var(--ag-crimson);background:var(--ag-surface-3);border-radius:6px;padding:2px 6px;letter-spacing:.03em;')}>OUR COURIER</span>
                            )}
                            {isCheapest && (
                              <span style={css('font-size:10px;font-weight:800;color:var(--ag-good);background:var(--ag-good-bg);border-radius:6px;padding:2px 6px;letter-spacing:.03em;')}>CHEAPEST</span>
                            )}
                          </div>
                          <div style={css('font-size:11.5px;color:var(--ag-muted);margin-top:2px;')}>
                            {c.provider === 'dtdc'
                              ? 'Contracted rate · pickup from your shop'
                              : `${c.days ? `~${c.days} days` : 'Delivery time varies'}`}
                          </div>
                        </div>
                        <div style={css('flex:none;text-align:right;')}>
                          {c.rate != null ? (
                            <span style={css('font-weight:800;font-size:14px;color:var(--ag-ink);font-variant-numeric:tabular-nums;')}>₹{Math.round(c.rate)}</span>
                          ) : (
                            <span style={css('font-size:11.5px;color:var(--ag-muted);font-weight:700;')}>—</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div style={css('font-size:11px;color:var(--ag-muted);margin-top:7px;line-height:1.5;')}>
                  Prices are the delivery cost (paid by MangaiMart, not deducted from you). DTDC is on our own account.
                </div>
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

            {/* The pickup address the courier is sent to. Confirmed on every
                booking because a wrong or incomplete one is a failed pickup, not
                a wrong label — and the shop phone is often blank, which is why
                the label has printed 0000000000. Prefilled; edits save back to
                the shop profile. */}
            {pickup && (
              <div style={css('margin-top:14px;border:1px solid var(--ag-border);border-radius:14px;padding:13px 14px;')}>
                <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:10px;')}>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('font-size:11.5px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>PICKUP FROM</div>
                    <div style={css('font-size:13px;color:var(--ag-ink);line-height:1.5;margin-top:4px;')}>
                      {[puAddress, puCity, puState, puPin && `PIN ${puPin}`].filter(Boolean).join(', ') || 'No pickup address on file'}
                    </div>
                    <div style={css(`font-size:12.5px;margin-top:3px;font-variant-numeric:tabular-nums;color:${phone10 ? 'var(--ag-muted)' : 'var(--ag-danger-text)'};`)}>
                      {puPhone.trim() ? `Contact ${puPhone}` : 'No contact phone — add one so the courier can reach you'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditPickup((v) => !v)}
                    style={css('flex:none;height:34px;padding:0 12px;border-radius:10px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-crimson);font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit;')}
                  >
                    {editPickup ? 'Done' : 'Edit'}
                  </button>
                </div>

                {editPickup && (
                  <div style={css('margin-top:12px;')}>
                    <div style={css(label)}>CONTACT PHONE</div>
                    <input value={puPhone} onChange={(e) => setPuPhone(e.target.value)} inputMode="tel" placeholder="10-digit mobile" style={css(field)} />
                    <div style={css(label + 'margin-top:10px;')}>PICKUP ADDRESS</div>
                    <input value={puAddress} onChange={(e) => setPuAddress(e.target.value)} placeholder="Door no, street, area" style={css(field)} />
                    <div style={css('display:flex;gap:10px;margin-top:10px;')}>
                      <div style={css('flex:1;min-width:0;')}>
                        <div style={css(label)}>CITY / TOWN</div>
                        <input value={puCity} onChange={(e) => setPuCity(e.target.value)} style={css(field)} />
                      </div>
                      <div style={css('flex:1;min-width:0;')}>
                        <div style={css(label)}>STATE</div>
                        <input value={puState} onChange={(e) => setPuState(e.target.value)} style={css(field)} />
                      </div>
                    </div>
                    <div style={css(label + 'margin-top:10px;')}>PINCODE</div>
                    <input value={puPin} onChange={(e) => setPuPin(e.target.value)} inputMode="numeric" placeholder="6-digit" style={css(field + 'font-variant-numeric:tabular-nums;')} />
                    <div style={css('font-size:12px;color:var(--ag-muted);margin-top:7px;line-height:1.5;')}>
                      Saved to your shop so you only set it once. The courier collects from here.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={css('margin-top:14px;background:var(--ag-surface-2);border:1px solid var(--ag-border);border-radius:14px;padding:13px 14px;')}>
              <div style={css('font-size:12.5px;color:var(--ag-muted);line-height:1.55;')}>
                The courier is asked to collect from the pickup address above in this slot, the tracking number comes
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
              {(() => {
                const blocked = busy || !selected || (!!pickup && !pickupReady);
                return (
                  <button
                    disabled={blocked}
                    onClick={() => selected && onBook?.({
                      carrier: selected.provider,
                      courierId: selected.courierId,
                      date: pickupDate,
                      slotStart: PICKUP_SLOTS[slotIdx].start, slotEnd: PICKUP_SLOTS[slotIdx].end,
                      pickup: { phone: puPhone.trim(), addressLine: puAddress.trim(), city: puCity.trim(), state: puState.trim(), pincode: puPin.trim() },
                    })}
                    style={css(`flex:1.4;height:50px;border:none;border-radius:13px;background:${blocked ? 'var(--ag-surface-2)' : 'linear-gradient(135deg,#D6336C,#B02454)'};color:${blocked ? 'var(--ag-muted)' : '#fff'};font-weight:800;cursor:${blocked ? 'default' : 'pointer'};font-family:inherit;`)}
                  >
                    {busy ? 'Scheduling…' : (!!pickup && !pickupReady) ? 'Add pickup phone & pincode' : 'Schedule & ship'}
                  </button>
                );
              })()}
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
