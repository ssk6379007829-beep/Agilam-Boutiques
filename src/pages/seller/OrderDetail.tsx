import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { css } from '@/lib/css';
import { useGoBack } from '@/hooks/useGoBack';
import { LoadError } from '@/components/seller/LoadError';
import { useShop } from '@/state/ShopContext';
import { TONES, fmt } from '@/data/demo';
import { useAsync } from '@/hooks/useAsync';
import { fetchOrder, updateOrderStatus, markOrderPacked } from '@/data/orders';
import type { OrderStatus } from '@/data/types';
import { toOrderView } from '@/lib/orderView';
import { useMyBoutique } from '@/hooks/useMyBoutique';
import { ShipSheet, type BookPayload } from '@/components/seller/ShipSheet';
import { ImageSlot } from '@/components/ui/ImageSlot';
import { fetchBoutiquePrivate, updateBoutique, type BoutiquePatch } from '@/data/boutiques';
import {
  bookParcel, cancelPickup, checkServiceability, createShipment, dtdcLabelUrl, fetchCouriers,
  fetchDtdcAvailability, fetchShadowfaxAvailability, fetchShipment, fetchShipmentEvents,
  fetchShiprocketAvailability, signedLabelUrl,
} from '@/data/shipments';
import { formatOrderDateTime, deliveryEstimate } from '@/lib/orderHistory';
import { useSettings } from '@/data/settings';
import { Skeleton, SkeletonGroup, SkeletonRows } from '@/components/ui/Skeleton';
import { fetchReturnForOrder, resolveReturnRequest, RETURN_REASON_LABEL } from '@/data/returns';

/** Seller-facing label for a normalised courier scan stage (migration 0067,
 *  0116). The courier's verbatim text is shown beside it; this is the fallback
 *  and the header label when there are no scans yet. */
const SELLER_SCAN_LABEL: Record<string, string> = {
  pickup_pending: 'Awaiting courier pickup',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  rto: 'Returning to the shop',
  failed: 'Delivery attempt failed',
};

/** The horizontal stage stepper, mirroring the courier's own tracking page:
 *  booked → picked up → in transit → out for delivery → delivered. */
const TRACK_STEPS = [
  { key: 'pickup', label: 'Awaiting pickup', icon: 'inventory_2' },
  { key: 'picked_up', label: 'Picked up', icon: 'package_2' },
  { key: 'in_transit', label: 'In transit', icon: 'local_shipping' },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: 'moped' },
  { key: 'delivered', label: 'Delivered', icon: 'check_circle' },
];
/** Which step the shipment's latest scan sits on. */
const STEP_INDEX: Record<string, number> = {
  pickup_pending: 0, picked_up: 1, in_transit: 2, out_for_delivery: 3, delivered: 4,
};

export function OrderDetail() {
  const navigate = useNavigate();
  const goBack = useGoBack('/seller/orders');
  const { id } = useParams();
  const { showToast } = useShop();

  const { boutique } = useMyBoutique();
  const { commission_pct: commissionPct, payout_sla_hours: slaHours } = useSettings();
  const orderId = decodeURIComponent(id ?? '');
  const { data: row, loading, error, reload } = useAsync(() => (orderId ? fetchOrder(orderId) : Promise.resolve(null)), [orderId]);
  const [confirmReject, setConfirmReject] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  // The buyer's return request on this order, if any (migration 0074).
  const [returnBump, setReturnBump] = useState(0);
  const [rejectNote, setRejectNote] = useState('');
  const [askingReject, setAskingReject] = useState(false);
  const [returnBusy, setReturnBusy] = useState(false);
  const [shipping, setShipping] = useState(false);
  // Cancelling a booked-but-not-collected DTDC pickup (two taps — a booking
  // undoes a real consignment at the courier, so it is confirmed first).
  const [confirmCancelPickup, setConfirmCancelPickup] = useState(false);
  const [cancellingPickup, setCancellingPickup] = useState(false);

  // Both read separately from the order (see src/data/shipments.ts): an
  // un-migrated deploy must degrade to "no tracking", never to a dead screen.
  const { data: couriers } = useAsync(() => fetchCouriers().catch(() => []), []);
  const { data: returnReq } = useAsync(
    () => (orderId ? fetchReturnForOrder(orderId) : Promise.resolve(null)),
    [orderId, returnBump],
  );

  /**
   * Record the seller's decision. `resolve_return_request` is the authority —
   * it re-checks shop ownership and refuses a rejection with no reason — so a
   * failure here is shown verbatim rather than translated.
   */
  const answerReturn = async (status: 'approved' | 'rejected', note?: string) => {
    if (!returnReq) return;
    setReturnBusy(true);
    try {
      await resolveReturnRequest(returnReq.id, status, note);
      showToast(status === 'approved' ? 'Return approved — the buyer has been told' : 'Buyer notified');
      setAskingReject(false);
      setRejectNote('');
      setReturnBump((n) => n + 1);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save that decision', 'error');
    } finally {
      setReturnBusy(false);
    }
  };
  const { data: shipment, reload: reloadShipment } = useAsync(
    () => (orderId ? fetchShipment(orderId) : Promise.resolve(null)),
    [orderId],
  );
  // The courier's own scans (migration 0067), newest first, so the seller can
  // see where the parcel is rather than only a docket number. Empty is normal:
  // a just-booked parcel has none until the courier collects it. Re-keyed on
  // last_status so it refreshes when a new scan lands.
  const { data: shipmentEvents } = useAsync(
    () => (orderId ? fetchShipmentEvents(orderId) : Promise.resolve([])),
    [orderId, shipment?.last_status],
  );
  const lastStatus = shipment?.last_status ?? null;
  const stepIdx = lastStatus ? (STEP_INDEX[lastStatus] ?? 0) : 0;
  const rtoShipment = lastStatus === 'rto' || lastStatus === 'failed';
  // Both switches on and a registered pickup location, or the booking mode is
  // never offered. Failing closed matters: the alternative is a seller tapping
  // "Book & ship" and getting a refusal from the Edge Function instead.
  //
  // Any carrier being on is enough to offer booking. Which one actually
  // carries the parcel is decided server-side by `book-parcel` — DTDC first
  // because it is the platform's contracted carrier, then Shiprocket because
  // it aggregates several couriers and so covers more rural pincodes, then
  // Shadowfax, then the manual docket form.
  const { data: courierAvailability } = useAsync(
    async () => {
      if (!boutique) return { dtdc: false, shadowfax: false, shiprocket: false };
      const [dtdc, shadowfax, shiprocket] = await Promise.all([
        fetchDtdcAvailability(boutique.id).catch(() => false),
        fetchShadowfaxAvailability(boutique.id).catch(() => false),
        fetchShiprocketAvailability(boutique.id).catch(() => false),
      ]);
      return { dtdc, shadowfax, shiprocket };
    },
    [boutique?.id],
  );
  const canBookCourier = Boolean(
    courierAvailability?.dtdc || courierAvailability?.shadowfax || courierAvailability?.shiprocket,
  );

  // Can any courier deliver this order's lane (shop pincode → buyer pincode)?
  // Shiprocket serviceability; fails open (null = couldn't tell). Only surfaced
  // before the parcel ships, as a heads-up that booking may fall through to the
  // manual docket.
  const { data: serviceLane } = useAsync(
    () => {
      const origin = boutique?.pincode ?? '';
      const dest = row?.guest_pincode ?? '';
      if (!origin || !dest) return Promise.resolve(null);
      return checkServiceability(origin, dest);
    },
    [boutique?.pincode, row?.guest_pincode],
  );

  // The shop's saved pickup address, prefilled into the ship sheet and editable
  // there. The phone is private (migration 0073), so it comes from the private
  // RPC rather than the boutique row; the rest is on the row.
  const { data: pickupInfo } = useAsync(
    async () => {
      if (!boutique) return null;
      const priv = await fetchBoutiquePrivate(boutique.id).catch(() => null);
      return {
        phone: priv?.phone ?? '',
        addressLine: boutique.address_line ?? '',
        city: boutique.city ?? boutique.district ?? '',
        state: boutique.state ?? '',
        pincode: boutique.pincode ?? '',
      };
    },
    [boutique?.id],
  );
  // The carriers the seller may choose from, DTDC first (the contracted
  // primary). The ship sheet shows these in a dropdown.
  const bookCarriers = [
    courierAvailability?.dtdc ? { id: 'dtdc', label: 'DTDC' } : null,
    courierAvailability?.shiprocket ? { id: 'shiprocket', label: 'Shiprocket' } : null,
    courierAvailability?.shadowfax ? { id: 'shadowfax', label: 'Shadowfax' } : null,
  ].filter((c): c is { id: string; label: string } => c !== null);

  const [labelBusy, setLabelBusy] = useState(false);
  // DTDC can only produce the label once it has finished "booking sync", a few
  // minutes after the AWB is issued. When a tap comes too early we flip to
  // 'preparing' and poll in the background until it is ready, then hold the URL
  // so the seller can open it. The ref lets us cancel the poll on unmount.
  const [labelPreparing, setLabelPreparing] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const labelPollRef = useRef<number | null>(null);
  useEffect(() => () => { if (labelPollRef.current) window.clearTimeout(labelPollRef.current); }, []);

  const openUrl = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  // Keep trying the DTDC label every 30s until it is ready (DTDC's sync is
  // usually done within a few minutes), then open it and leave it on the button.
  const pollForLabel = (attempt = 1) => {
    labelPollRef.current = window.setTimeout(async () => {
      try {
        const url = await dtdcLabelUrl(o.id);
        setLabelUrl(url);
        setLabelPreparing(false);
        showToast('Your label is ready.', 'success');
        openUrl(url); // best-effort; the button is now "Open label" either way
      } catch (e) {
        const notReady = (e as { notReady?: boolean }).notReady;
        if (notReady && attempt < 8) {
          pollForLabel(attempt + 1);
        } else {
          setLabelPreparing(false);
          showToast(
            notReady
              ? 'The label is still being prepared by DTDC. Tap Download label again in a few minutes.'
              : (e instanceof Error ? e.message : 'Could not get the label'),
            notReady ? 'warning' : 'error',
          );
        }
      }
    }, 30000);
  };

  /**
   * Open the shipping label PDF for the seller to print and stick on the parcel.
   *
   * For a DTDC parcel we fetch it FRESH from DTDC every time (`dtdcLabelUrl`),
   * not from the copy saved at booking — that booking-time save is best-effort,
   * so relying on it means a seller whose save failed has no label at all. A
   * Shiprocket label is a carrier-hosted public link; a stored label (older
   * flows) is signed from the private bucket on the click.
   */
  const openLabel = async () => {
    if (!shipment) return;
    // Already fetched this session — just reopen it, no round trip.
    if (labelUrl) { openUrl(labelUrl); return; }
    setLabelBusy(true);
    try {
      if (shipment.provider === 'dtdc') {
        try {
          const url = await dtdcLabelUrl(o.id);
          setLabelUrl(url);
          openUrl(url);
        } catch (e) {
          if ((e as { notReady?: boolean }).notReady) {
            setLabelPreparing(true);
            showToast('The label is being prepared — DTDC usually has it ready within a few minutes. We’ll open it automatically once it’s ready.', 'info');
            pollForLabel();
          } else {
            showToast(e instanceof Error ? e.message : 'Could not open the label', 'error');
          }
        }
        return;
      }
      if (shipment.label_path) {
        const url = await signedLabelUrl(shipment.label_path);
        if (!url) {
          showToast('Could not open the label right now — try again in a moment', 'error');
          return;
        }
        openUrl(url);
        return;
      }
      if (shipment.label_url) openUrl(shipment.label_url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not open the label', 'error');
    } finally {
      setLabelBusy(false);
    }
  };

  // Set when both carriers decline, which drops the sheet onto the manual
  // docket form. The seller is not left holding a packed parcel and no button.
  const [manualOnly, setManualOnly] = useState(false);

  if (!row && loading) {
    return (
      <SkeletonGroup label="Loading order…" style="padding:16px 20px;">
        <Skeleton w="52%" h={26} radius={9} />
        <Skeleton w="34%" h={12} style="margin-top:12px;" />
        <div style={css('margin-top:20px;')}><SkeletonRows rows={3} height={72} /></div>
        <Skeleton w="100%" h={120} radius={18} style="margin-top:16px;" />
      </SkeletonGroup>
    );
  }

  // A failed fetch is not a missing order. Saying "not found" here would tell a
  // seller their order had been deleted, which is both wrong and alarming.
  if (error) {
    return (
      <div style={css('padding:20px;')}>
        <LoadError
          title="Couldn’t load this order"
          detail="The order still exists and nothing about it has changed — this page just can’t reach it right now."
          onRetry={reload}
        />
      </div>
    );
  }

  if (!row) {
    return (
      <div style={css('min-height:60vh;display:flex;align-items:center;justify-content:center;color:var(--ag-muted);font-size:15px;')}>
        Order not found.
      </div>
    );
  }

  const o = toOrderView(row);
  const subtotal = o.amount;

  const setStatus = async (status: OrderStatus, msg: string) => {
    try {
      await updateOrderStatus(o.id, status);
      showToast(msg);
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed', 'error');
    }
  };

  /**
   * Record the parcel, then move the order to 'shipped'.
   *
   * Order matters: migration 0063's trigger refuses the transition until a
   * shipment row exists, so the write has to land first. If the status update
   * then fails the shipment row is left behind — harmless, and the seller simply
   * ships again (the unique constraint on order_id means the retry updates
   * nothing rather than duplicating).
   */
  const shipOrder = async (v: { courierId: string | null; courierName: string; awb: string; trackingUrl: string | null }) => {
    if (!row) return;
    setShipping(true);
    try {
      await createShipment({
        orderId: o.id,
        boutiqueId: row.boutique_id,
        courierId: v.courierId,
        courierName: v.courierName,
        awb: v.awb,
        trackingUrl: v.trackingUrl,
      });
      await updateOrderStatus(o.id, 'shipped');
      setShipOpen(false);
      showToast(`Shipped via ${v.courierName}`);
      reloadShipment();
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not ship this order', 'error');
    } finally {
      setShipping(false);
    }
  };

  /**
   * Book the parcel with Shiprocket, which also ships the order.
   *
   * Everything happens server-side in the `shiprocket-book` Edge Function — it
   * creates their order, gets an AWB assigned, writes the shipment row and
   * flips the status — because the whole sequence needs the service role and
   * must not be half-completed by a browser that navigated away mid-flight.
   *
   * There is no retry here on purpose. A failure after the AWB is issued means
   * a real parcel exists, and a second attempt would book (and pay for) a
   * second one; the function returns an explicit "do not book again" in that
   * case and it is surfaced verbatim.
   */
  const bookOrder = async (payload: BookPayload) => {
    setShipping(true);
    try {
      // Persist any pickup-address edit the seller made in the sheet BEFORE
      // booking — the booking reads the shop's address server-side, so the row
      // has to carry the corrected values first. Only the changed fields are
      // written, and only when they actually differ.
      if (boutique && pickupInfo) {
        const p = payload.pickup;
        const patch: BoutiquePatch = {};
        if (p.phone && p.phone !== pickupInfo.phone) patch.phone = p.phone;
        if (p.addressLine !== pickupInfo.addressLine) patch.address_line = p.addressLine;
        if (p.city !== pickupInfo.city) patch.city = p.city;
        if (p.state !== pickupInfo.state) patch.state = p.state;
        if (p.pincode !== pickupInfo.pincode) patch.pincode = p.pincode;
        if (Object.keys(patch).length > 0) await updateBoutique(boutique.id, patch);
      }

      // The seller chose the courier and the pickup slot; book-parcel honours
      // that choice and schedules the DTDC pickup rather than auto-picking.
      const booked = await bookParcel(o.id, {
        carrier: payload.carrier, date: payload.date,
        slotStart: payload.slotStart, slotEnd: payload.slotEnd,
      });

      setShipOpen(false);

      // ONE toast. The toast host holds a single slot, so three calls in a row
      // leave only the last one on screen — and the AWB, the part the seller
      // may need to write down, was the first. Everything goes in one message.
      const parts = [`Booked with ${booked.courierName} · ${booked.awb}`];
      if ('fellBack' in booked && booked.fellBack) {
        // Not an error, but a parcel went by the second carrier rather than the
        // usual one. Named rather than explained: the seller only needs to know
        // who is turning up at their door, and which carrier declined first is
        // our problem, not theirs.
        parts.push('Our usual courier could not collect this one.');
      }
      if (booked.weightEstimated) {
        // Worth saying: the courier weighs the parcel themselves and bills the
        // difference, so a guessed weight becomes a real charge.
        parts.push('Some items have no weight set — we used your shop default. Set item weights to avoid extra charges.');
      }
      showToast(parts.join(' '), booked.weightEstimated ? 'warning' : 'success');
      reloadShipment();
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not book this parcel', 'error');
      // Both carriers declined. Drop the sheet onto the manual form rather than
      // leaving the seller with a packed parcel and a button that just failed.
      if ((e as { canShipManually?: boolean }).canShipManually) setManualOnly(true);
    } finally {
      setShipping(false);
    }
  };

  /**
   * Call off a DTDC pickup the seller booked by mistake — wrong slot, wrong
   * day, or they would rather hand it to another courier. The Edge Function
   * cancels the consignment at DTDC, deletes the shipment, and drops the order
   * back to 'accepted' so the ship bar returns. It refuses once the courier has
   * scanned the parcel (a collected parcel is cancelled through DTDC support),
   * and that refusal is surfaced verbatim.
   */
  const cancelParcelPickup = async () => {
    setCancellingPickup(true);
    try {
      await cancelPickup(o.id);
      setConfirmCancelPickup(false);
      showToast('Pickup cancelled — the order is back to accepted, ready to re-book');
      reloadShipment();
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not cancel the pickup', 'error');
    } finally {
      setCancellingPickup(false);
    }
  };

  // A booked DTDC parcel the courier has not yet collected can still be called
  // off from here. Once there is any pickup scan beyond "awaiting", it is in the
  // courier's hands and only DTDC support can cancel it.
  const canCancelPickup =
    shipment?.provider === 'dtdc' &&
    (!shipment.last_status || shipment.last_status === 'pickup_pending');

  // A parcel we booked on a courier (DTDC/Shiprocket/Shadowfax) is marked
  // delivered by the courier's own scan, not by the seller — so the manual
  // "Mark delivered" button is hidden for it. A self-shipped parcel (provider
  // 'manual', the seller typed a docket) still needs the button: nothing else
  // can close it out.
  const courierBooked = Boolean(shipment && shipment.provider && shipment.provider !== 'manual');

  const settled = o.isCod && o.paymentStatus === 'paid';
  const closed = o.rawStatus === 'rejected' || o.rawStatus === 'cancelled';

  return (
    <div style={css('min-height:100%;background:var(--ag-bg);display:flex;flex-direction:column;')}>
      <div style={css('padding:6px 20px 12px;display:flex;align-items:center;gap:10px;')}>
        <button onClick={goBack} aria-label="Go back" className="agx-con-icon">
          <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-crimson);")}>arrow_back</span>
        </button>
        <div>
          <h1 style={css("font-family:var(--ag-display);font-weight:700;font-size:22px;line-height:1;margin:0;")}>Order {o.number}</h1>
          <div style={css('font-size:12px;color:var(--ag-muted);')}>Placed {o.date} · {o.status}</div>
        </div>
      </div>

      <div style={css('flex:1;padding:4px 20px 0;')}>
        {/* ---------- Return request (migration 0074) ---------- */}
        {/* First card on the page when there is one: a buyer waiting on a
            return answer is the most time-sensitive thing on this screen, and
            it used to have no seller-side surface at all. */}
        {returnReq && (
          <div style={css(`background:var(--ag-surface);border:1.5px solid ${returnReq.status === 'requested' ? 'var(--ag-warn-text)' : 'var(--ag-border)'};border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);`)}>
            <div style={css('display:flex;align-items:center;gap:8px;')}>
              <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:19px;color:var(--ag-gold-text);")}>autorenew</span>
              <div style={css('font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>
                RETURN {returnReq.status === 'requested' ? 'REQUESTED' : returnReq.status.toUpperCase()}
              </div>
            </div>
            <div style={css('font-size:14px;font-weight:800;margin-top:9px;')}>{RETURN_REASON_LABEL[returnReq.reason]}</div>
            {returnReq.note && (
              <div style={css('font-size:13px;color:var(--ag-ink-2);line-height:1.5;margin-top:4px;')}>{returnReq.note}</div>
            )}
            {returnReq.photos.length > 0 && (
              <div style={css('display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;')}>
                {returnReq.photos.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={css('width:64px;height:64px;border-radius:11px;overflow:hidden;border:1px solid var(--ag-border);display:block;')}>
                    <img src={url} alt="Buyer's photo of the problem" style={css('width:100%;height:100%;object-fit:cover;')} />
                  </a>
                ))}
              </div>
            )}
            {returnReq.status === 'requested' ? (
              askingReject ? (
                <div style={css('margin-top:12px;')}>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value.slice(0, 300))}
                    rows={2}
                    placeholder="Tell the buyer why — this is required."
                    style={css('display:block;width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--ag-border);border-radius:12px;background:var(--ag-bg);color:var(--ag-ink);font-family:inherit;font-size:13.5px;resize:vertical;')}
                  />
                  <div style={css('display:flex;gap:9px;margin-top:9px;')}>
                    <button
                      onClick={() => { setAskingReject(false); setRejectNote(''); }}
                      style={css('flex:1;height:42px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:12px;font-weight:700;font-size:13px;color:var(--ag-label);cursor:pointer;font-family:inherit;')}
                    >
                      Back
                    </button>
                    <button
                      disabled={returnBusy || !rejectNote.trim()}
                      onClick={() => void answerReturn('rejected', rejectNote)}
                      style={css(`flex:1;height:42px;border:none;border-radius:12px;background:var(--ag-danger-text);color:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;opacity:${returnBusy || !rejectNote.trim() ? 0.6 : 1};`)}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              ) : (
                <div style={css('display:flex;gap:9px;margin-top:13px;')}>
                  <button
                    disabled={returnBusy}
                    onClick={() => setAskingReject(true)}
                    style={css('flex:1;height:44px;border:1.5px solid var(--ag-border);background:var(--ag-surface);border-radius:12px;font-weight:700;font-size:13px;color:var(--ag-label);cursor:pointer;font-family:inherit;')}
                  >
                    Can't accept
                  </button>
                  <button className="agx-con-btn"
                    disabled={returnBusy}
                    onClick={() => void answerReturn('approved')}
                    style={css('flex:1;height:44px;border:none;border-radius:12px;color:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;')}
                  >
                    Approve return
                  </button>
                </div>
              )
            ) : (
              returnReq.seller_note && (
                <div style={css('font-size:12.5px;color:var(--ag-muted);margin-top:9px;line-height:1.5;')}>
                  Your reply: {returnReq.seller_note}
                </div>
              )
            )}
          </div>
        )}

        <div style={css('background:var(--ag-surface);border-radius:16px;padding:14px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>CUSTOMER</div>
          <div style={css('display:flex;align-items:center;gap:11px;margin-top:8px;')}>
            <div style={css("width:44px;height:44px;border-radius:13px;background:var(--ag-surface-2);display:flex;align-items:center;justify-content:center;font-weight:700;color:rgba(42,26,32,.5);")}>{o.customer[0]}</div>
            <div style={css('flex:1;')}>
              <div style={css('font-weight:800;font-size:14px;')}>{o.customer}</div>
              <div style={css('font-size:12px;color:var(--ag-muted);display:flex;align-items:center;gap:5px;flex-wrap:wrap;')}>
                <span>{o.city || 'Customer'}</span>
                {o.phone && (
                  <>
                    <span>·</span>
                    <a
                      href={`tel:${o.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      style={css('display:inline-flex;align-items:center;gap:3px;color:var(--ag-crimson);font-weight:700;text-decoration:none;')}
                    >
                      {o.phone}
                      <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:14px;")}>call</span>
                    </a>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => navigate('/seller/messages')} style={css('width:44px;height:44px;border-radius:11px;border:none;background:var(--ag-surface-2);cursor:pointer;display:flex;align-items:center;justify-content:center;')}>
              <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-crimson);")}>chat</span>
            </button>
          </div>
          {/* The delivery address lives on the order (guest checkout keeps no
              account), so this card is the only place the seller can read it. */}
          {(o.address || o.city || o.pincode) && (
            <div style={css('margin-top:12px;padding:11px 12px;border-radius:12px;background:var(--ag-bg);display:flex;gap:9px;align-items:flex-start;')}>
              <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;color:var(--ag-crimson);")}>home_pin</span>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css('font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>DELIVER TO</div>
                <div style={css('font-size:13px;color:var(--ag-ink);margin-top:3px;line-height:1.45;')}>
                  {[o.address, o.city, o.pincode ? `PIN ${o.pincode}` : null].filter(Boolean).join(', ')}
                </div>
              </div>
            </div>
          )}

        </div>

        <div style={css('background:var(--ag-surface);border-radius:16px;padding:14px;margin-top:12px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
          <div style={css('font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>
            {o.items.length > 1 ? `ITEMS · ${o.items.length}` : 'ITEM'}
          </div>
          {/* Every line, not just the first: a seller packing a multi-item order
              has to see all of it, and tapping a line opens that product so the
              stock and photo are one tap away from the order being packed. */}
          {o.items.map((it) => {
            const open = it.product_id ? () => navigate(`/seller/products/${it.product_id}`) : undefined;
            return (
              <div
                key={it.id}
                onClick={open}
                style={css(`display:flex;gap:11px;align-items:center;margin-top:10px;cursor:${open ? 'pointer' : 'default'};`)}
              >
                <ImageSlot
                  src={it.product?.image_url ?? undefined}
                  placeholder={it.title}
                  alt={it.title}
                  style={css(`width:56px;height:56px;flex:none;border-radius:13px;background:${TONES[(it.product?.tone ?? o.tone) % 8]};`)}
                />
                <div style={css('flex:1;min-width:0;')}>
                  <div style={css('font-weight:700;font-size:13.5px;')}>{it.title}</div>
                  <div style={css('font-size:12px;color:var(--ag-muted);')}>Size {it.size ?? 'Free'} · {it.color ?? '—'} · Qty {it.qty}</div>
                </div>
                <div style={css('display:flex;align-items:center;gap:2px;')}>
                  <span style={css('font-weight:800;color:var(--ag-crimson);')}>{fmt(Number(it.price) * it.qty)}</span>
                  {open && <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;color:var(--ag-muted-soft);")}>chevron_right</span>}
                </div>
              </div>
            );
          })}
          {o.items.length === 0 && (
            <div style={css('margin-top:8px;font-size:13px;color:var(--ag-muted);')}>No item lines recorded on this order.</div>
          )}
          <div style={css('border-top:1px solid var(--ag-border-soft);margin-top:12px;padding-top:10px;display:flex;justify-content:space-between;font-size:13px;color:var(--ag-muted);')}>
            <span>Subtotal</span><span style={css('font-weight:700;color:var(--ag-ink);')}>{fmt(subtotal)}</span>
          </div>
          {/* A MangaiMart coupon is funded by us, not the boutique: the seller
              is still paid on the full subtotal above, but the customer hands
              over this much less — so it has to be on the bill they both read. */}
          {o.platformDiscount > 0 && (
            <div style={css('display:flex;justify-content:space-between;font-size:13px;color:var(--ag-muted);margin-top:4px;')}>
              <span>MangaiMart offer</span>
              <span style={css('font-weight:700;color:var(--ag-good);')}>− {fmt(o.platformDiscount)}</span>
            </div>
          )}
          <div style={css('display:flex;justify-content:space-between;font-size:13px;color:var(--ag-muted);margin-top:4px;')}>
            <span>Delivery</span>
            <span style={css(`font-weight:700;color:${o.shippingFee === 0 ? 'var(--ag-good)' : 'var(--ag-ink)'};`)}>
              {o.shippingFee === 0 ? 'Free' : fmt(o.shippingFee)}
            </span>
          </div>
          {o.codFee > 0 && (
            <div style={css('display:flex;justify-content:space-between;font-size:13px;color:var(--ag-muted);margin-top:4px;')}>
              <span>Cash handling fee</span><span style={css('font-weight:700;color:var(--ag-ink);')}>{fmt(o.codFee)}</span>
            </div>
          )}
          <div style={css('display:flex;justify-content:space-between;margin-top:8px;font-weight:800;font-size:15px;')}>
            <span>Total</span><span style={css('color:var(--ag-crimson);')}>{fmt(o.grandTotal)}</span>
          </div>
          {/* Prepaid vs cash-on-delivery changes what the seller does at the
              door, so it's stated next to the amount rather than buried. */}
          {o.paymentMethod && (
            <div style={css('display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--ag-border-soft);font-size:13px;')}>
              <span style={css('color:var(--ag-muted);')}>Payment · {o.paymentMethod}</span>
              {/* A cancelled/rejected COD order is neither collected nor still
                  collectable — it must not read "Collect on delivery". */}
              <span style={css(`font-weight:800;padding:3px 10px;border-radius:8px;background:${!o.isCod || settled ? 'var(--ag-good-bg)' : closed ? 'var(--ag-surface-2)' : 'var(--ag-warn-bg)'};color:${!o.isCod || settled ? 'var(--ag-good)' : closed ? 'var(--ag-muted)' : 'var(--ag-warn-text)'};`)}>
                {!o.isCod ? 'Paid online' : settled ? 'Cash collected' : closed ? 'Not collected' : 'Collect on delivery'}
              </span>
            </div>
          )}
        </div>

        {/* YOUR EARNINGS — the one number the seller actually cares about, with
            the full math so there are no surprises. Prepaid only: a legacy COD
            order settles by netting cash the seller already holds, which is a
            different sum and is explained on the Earnings screen instead.
            Commission is the platform's only cut — delivery goes to the platform
            and the Razorpay charge is on the platform, NOT deducted here. */}
        {!o.isCod && !closed && (() => {
          const rate = commissionPct / 100;
          const goods = o.amount;                 // item value the commission is taken on
          const commissionAmt = goods * rate;
          const payout = goods - commissionAmt;
          const amt = 'font-weight:700;font-variant-numeric:tabular-nums;';
          const row = 'display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-top:8px;';
          return (
            <div style={css('background:var(--ag-surface);border-radius:16px;padding:14px;margin-top:12px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
              <div style={css('font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>YOUR EARNINGS</div>

              <div style={css(row)}>
                <span style={css('color:var(--ag-muted);')}>Item total</span>
                <span style={css(amt + 'color:var(--ag-ink);')}>{fmt(goods)}</span>
              </div>
              <div style={css(row)}>
                <span style={css('color:var(--ag-muted);')}>MangaiMart commission ({commissionPct}%)</span>
                <span style={css(amt + 'color:var(--ag-danger-text);')}>− {fmt(commissionAmt)}</span>
              </div>
              <div style={css(row)}>
                <span style={css('color:var(--ag-muted);')}>Payment / Razorpay charges</span>
                <span style={css('font-weight:700;color:var(--ag-good);')}>Covered by us</span>
              </div>
              {o.shippingFee > 0 && (
                <div style={css(row)}>
                  <span style={css('color:var(--ag-muted);')}>Delivery (paid by customer)</span>
                  <span style={css('font-weight:700;color:var(--ag-muted);')}>Not your charge</span>
                </div>
              )}

              <div style={css('display:flex;justify-content:space-between;align-items:center;margin-top:11px;padding-top:11px;border-top:1px solid var(--ag-border-soft);')}>
                <span style={css('font-weight:800;font-size:14px;')}>You receive</span>
                <span style={css('font-weight:800;font-size:18px;color:var(--ag-crimson);font-variant-numeric:tabular-nums;')}>{fmt(payout)}</span>
              </div>

              <div style={css('font-size:11.5px;color:var(--ag-muted);line-height:1.55;margin-top:9px;')}>
                The {commissionPct}% is all we take — Razorpay and payment-gateway fees are on us, nothing extra is deducted.
                Paid to your bank after the order is delivered{slaHours ? `, within ${slaHours} hours of delivery` : ''}.
              </div>
            </div>
          );
        })()}

        {/* No courier serves this lane — a heads-up BEFORE the seller tries to
            book, so a parcel that would only bounce to the manual docket is
            flagged early. Only a definite "no" shows (fails open). */}
        {!shipment && (o.rawStatus === 'pending' || o.rawStatus === 'accepted') && serviceLane?.serviceable === false && (
          <div style={css('margin-top:12px;border-radius:16px;padding:14px;border:1.5px solid var(--ag-warn-text);background:var(--ag-warn-bg);display:flex;gap:11px;align-items:flex-start;')}>
            <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-warn-text);")}>local_shipping</span>
            <div style={css('font-size:12.5px;color:var(--ag-warn-text);font-weight:700;line-height:1.55;')}>
              No courier currently delivers to PIN {o.pincode} from your shop pincode. Booking may fail — you can ship this one with your own courier and enter the docket number.
            </div>
          </div>
        )}

        {/* Once dispatched, the docket is the thing the seller gets asked about
            on the phone — so it sits on the order, copyable, not buried. */}
        {shipment && (
          <div style={css('background:var(--ag-surface);border-radius:16px;padding:14px;margin-top:12px;box-shadow:0 10px 26px -22px rgba(107,20,54,.6);')}>
            <div style={css('font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>SHIPMENT</div>
            <div style={css('display:flex;align-items:center;gap:11px;margin-top:10px;')}>
              <span style={css('width:42px;height:42px;flex:none;border-radius:13px;background:var(--ag-surface-2);display:flex;align-items:center;justify-content:center;')}>
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-crimson);")}>local_shipping</span>
              </span>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css('font-weight:800;font-size:14px;')}>{shipment.courier_name}</div>
                <div style={css('font-size:12.5px;color:var(--ag-muted);word-break:break-all;')}>{shipment.awb}</div>
              </div>
              <button
                onClick={() => { void navigator.clipboard?.writeText(shipment.awb); showToast('Tracking number copied'); }}
                aria-label="Copy tracking number"
                style={css('width:44px;height:44px;flex:none;border-radius:11px;border:none;background:var(--ag-surface-2);cursor:pointer;display:flex;align-items:center;justify-content:center;')}
              >
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:19px;color:var(--ag-crimson);")}>content_copy</span>
              </button>
            </div>

            {/* Where the parcel actually is — the courier's own scans (0067),
                newest first. Until the courier collects it there are none, so
                say that plainly rather than leave the seller guessing. */}
            <div style={css('margin-top:13px;border-top:1px solid var(--ag-border);padding-top:12px;')}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
                <span style={css('font-size:12px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;')}>STATUS</span>
                <span style={css('font-weight:800;font-size:13px;color:var(--ag-crimson);text-align:right;')}>
                  {shipmentEvents?.[0]?.raw_status
                    ?? (shipment.last_status ? (SELLER_SCAN_LABEL[shipment.last_status] ?? shipment.last_status) : 'Awaiting courier pickup')}
                </span>
              </div>

              {/* Stage stepper — the parcel's progress at a glance, like the
                  courier's own tracking page. */}
              <div style={css('display:flex;align-items:flex-start;margin-top:16px;')}>
                {TRACK_STEPS.map((step, i) => {
                  const done = !rtoShipment && i <= stepIdx;
                  const current = !rtoShipment && i === stepIdx;
                  return (
                    <div key={step.key} style={css('flex:1;display:flex;flex-direction:column;align-items:center;position:relative;min-width:0;')}>
                      {i > 0 && (
                        <span style={css(`position:absolute;top:13px;right:50%;width:100%;height:2px;background:${!rtoShipment && i <= stepIdx ? 'var(--ag-crimson)' : 'var(--ag-border)'};`)} />
                      )}
                      <span style={css(`position:relative;z-index:1;width:27px;height:27px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${done ? 'var(--ag-crimson)' : 'var(--ag-surface-2)'};border:2px solid ${done || current ? 'var(--ag-crimson)' : 'var(--ag-border)'};`)}>
                        <span aria-hidden="true" style={css(`font-family:'Material Symbols Outlined';font-size:15px;color:${done ? '#fff' : 'var(--ag-muted)'};`)}>{step.icon}</span>
                      </span>
                      <span style={css(`font-size:9px;font-weight:700;margin-top:5px;text-align:center;line-height:1.2;color:${done || current ? 'var(--ag-ink)' : 'var(--ag-muted)'};`)}>{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {rtoShipment && (
                <div style={css('margin-top:12px;font-size:12.5px;font-weight:700;color:var(--ag-warn-text);line-height:1.5;')}>
                  {shipment.last_status === 'rto'
                    ? 'The parcel is being returned to your shop.'
                    : 'The courier reported a problem delivering this parcel.'}
                </div>
              )}

              <div style={css('display:flex;gap:22px;margin-top:16px;')}>
                <div>
                  <div style={css('font-size:10.5px;font-weight:800;color:var(--ag-muted);letter-spacing:.04em;')}>BOOKED ON</div>
                  <div style={css('font-size:12.5px;font-weight:700;margin-top:2px;')}>{formatOrderDateTime(shipment.shipped_at) || '—'}</div>
                </div>
                <div>
                  <div style={css('font-size:10.5px;font-weight:800;color:var(--ag-muted);letter-spacing:.04em;')}>EST. DELIVERY</div>
                  <div style={css('font-size:12.5px;font-weight:700;margin-top:2px;')}>{deliveryEstimate(shipment.shipped_at) || '—'}</div>
                </div>
              </div>

              <div style={css('font-size:11px;font-weight:800;color:var(--ag-muted);letter-spacing:.05em;margin-top:16px;margin-bottom:2px;')}>SCAN HISTORY</div>
              {shipmentEvents && shipmentEvents.length > 0 ? (
                <div style={css('margin-top:12px;')}>
                  {shipmentEvents.map((ev, i) => (
                    <div key={ev.id} style={css('display:flex;gap:11px;')}>
                      <div style={css('display:flex;flex-direction:column;align-items:center;')}>
                        <span style={css(`width:9px;height:9px;flex:none;border-radius:50%;margin-top:4px;background:${i === 0 ? 'var(--ag-crimson)' : 'var(--ag-border)'};`)} />
                        {i < shipmentEvents.length - 1 && <span style={css('flex:1;width:2px;background:var(--ag-border);margin:2px 0;')} />}
                      </div>
                      <div style={css('padding-bottom:13px;min-width:0;')}>
                        <div style={css('font-weight:700;font-size:13px;line-height:1.35;')}>{ev.raw_status}</div>
                        <div style={css('font-size:11.5px;color:var(--ag-muted);margin-top:1px;')}>
                          {[ev.location, formatOrderDateTime(ev.occurred_at ?? ev.created_at)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={css('margin-top:8px;font-size:12.5px;color:var(--ag-muted);line-height:1.5;')}>
                  The courier has the booking. Each scan — picked up, in transit, out for delivery, delivered — will appear here as it happens.
                </div>
              )}
            </div>

            {/* "Track shipment" links out only when the courier has a real
                per-consignment page. DTDC has none — their public tracker lands
                on a blank form you'd have to retype the AWB into — so for a DTDC
                parcel we show no external link; the stage stepper and scan
                history above ARE the exact tracking, in place. */}
            {((shipment.tracking_url && shipment.provider !== 'dtdc') || shipment.provider === 'dtdc' || shipment.label_path || shipment.label_url) && (
              <div style={css('display:flex;gap:10px;margin-top:12px;')}>
                {/* The label is what gets stuck on the parcel before the courier
                    arrives, so it sits beside tracking. For a DTDC parcel it is
                    always offered and fetched fresh from DTDC on the tap, so it
                    works even if the booking-time save missed. */}
                {(shipment.provider === 'dtdc' || shipment.label_path || shipment.label_url) && (
                  <button
                    type="button"
                    disabled={labelBusy || labelPreparing}
                    onClick={() => { void openLabel(); }}
                    style={css(`flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:44px;border-radius:13px;border:none;background:var(--ag-surface-2);color:var(--ag-crimson);font-weight:800;font-size:13.5px;cursor:${labelBusy || labelPreparing ? 'default' : 'pointer'};font-family:inherit;opacity:${labelBusy || labelPreparing ? 0.6 : 1};`)}
                  >
                    {labelPreparing ? 'Preparing label…' : labelBusy ? 'Opening…' : labelUrl ? 'Open label' : 'Download label'}
                    <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>print</span>
                  </button>
                )}
                {shipment.tracking_url && shipment.provider !== 'dtdc' && (
                  <a
                    href={shipment.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={css('flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:44px;border-radius:13px;background:var(--ag-surface-2);color:var(--ag-crimson);font-weight:800;font-size:13.5px;text-decoration:none;')}
                  >
                    Track shipment
                    <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>open_in_new</span>
                  </a>
                )}
              </div>
            )}

            {/* What the label is for — the seller prints it and sticks it on the
                parcel, barcode and all, before the courier collects it. */}
            {(shipment.provider === 'dtdc' || shipment.label_path || shipment.label_url) && (
              <div style={css('margin-top:7px;font-size:11.5px;color:var(--ag-muted);line-height:1.5;')}>
                Print this label and stick it on the parcel before the courier collects it — the barcode is what they scan.
              </div>
            )}

            {/* Why there is no "Mark delivered" button: a booked courier closes
                the order itself, on its delivery scan, which then releases the
                payout. Shown while the parcel is still on its way. */}
            {courierBooked && o.rawStatus === 'shipped' && (
              <div style={css('margin-top:12px;display:flex;gap:9px;align-items:flex-start;background:var(--ag-surface-2);border-radius:12px;padding:11px 13px;')}>
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;color:var(--ag-crimson);")}>auto_awesome</span>
                <div style={css('font-size:12.5px;color:var(--ag-ink-2);line-height:1.5;')}>
                  No action needed from you — the courier marks this delivered on its own scan, and your payout is released after that. You don’t mark it delivered yourself.
                </div>
              </div>
            )}

            {/* Cancel a booked-but-not-collected DTDC pickup. Only offered while
                the courier has no scan on it yet; once collected, this is gone
                and a cancellation goes through DTDC support. */}
            {canCancelPickup && (
              confirmCancelPickup ? (
                <div style={css('margin-top:12px;background:var(--ag-bad-bg);border:1px solid var(--ag-border);border-radius:14px;padding:13px 15px;')}>
                  <div style={css('font-size:12.5px;font-weight:700;color:var(--ag-danger-text);line-height:1.5;')}>
                    Cancel this pickup? The DTDC booking is called off and the order returns to “accepted”, so you can book it again — a different slot, day, or courier.
                  </div>
                  <div style={css('display:flex;gap:10px;margin-top:11px;')}>
                    <button
                      disabled={cancellingPickup}
                      onClick={() => setConfirmCancelPickup(false)}
                      style={css('flex:1;height:46px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-label);border-radius:12px;font-weight:800;cursor:pointer;font-family:inherit;')}
                    >
                      Keep pickup
                    </button>
                    <button
                      disabled={cancellingPickup}
                      onClick={() => { void cancelParcelPickup(); }}
                      style={css(`flex:1;height:46px;border:none;background:var(--ag-danger-text);color:#fff;border-radius:12px;font-weight:800;cursor:${cancellingPickup ? 'default' : 'pointer'};font-family:inherit;opacity:${cancellingPickup ? 0.6 : 1};`)}
                    >
                      {cancellingPickup ? 'Cancelling…' : 'Cancel pickup'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancelPickup(true)}
                  style={css('width:100%;margin-top:10px;height:44px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:13px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-danger-text);font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit;')}
                >
                  <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:17px;")}>cancel</span>
                  Cancel pickup
                </button>
              )
            )}
          </div>
        )}

        {o.rawStatus === 'cancelled' && (
          <div style={css('margin-top:12px;border-radius:16px;padding:14px 16px;border:1px solid var(--ag-border);background:var(--ag-surface-2);display:flex;gap:11px;')}>
            <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';color:var(--ag-muted);")}>cancel</span>
            <div style={css('font-size:13px;color:var(--ag-label);font-weight:600;line-height:1.55;')}>
              The customer cancelled this order before dispatch{o.cancelReason ? ` — “${o.cancelReason}”` : ''}. The stock has been returned to your catalogue.
            </div>
          </div>
        )}
      </div>

      {/* Fulfilment moves one step at a time: pending → accepted → shipped →
          delivered. The bar only ever offers the next real step, so a seller
          can't mark an order delivered before it shipped, and Reject disappears
          the moment the parcel is on its way — you can't reject after dispatch,
          let alone after delivery. Terminal states (delivered / rejected /
          cancelled) have no further move, so the bar goes away entirely. */}
      {(() => {
        // Reject is only honest while the order is still in the seller's hands.
        const canReject = o.rawStatus === 'pending' || o.rawStatus === 'accepted';
        const forward =
          o.rawStatus === 'pending'
            ? { status: 'accepted' as const, label: 'Accept order', msg: 'Order accepted' }
            : o.rawStatus === 'accepted'
              ? { status: 'shipped' as const, label: 'Mark shipped', msg: 'Marked as shipped' }
              : o.rawStatus === 'shipped'
                // A courier-booked parcel is marked delivered by the courier's
                // own scan, so the seller is NOT offered a manual button for it
                // (the auto-delivery note in the shipment card explains). Only a
                // self-shipped parcel still needs the seller to close it out.
                ? (courierBooked ? null : { status: 'delivered' as const, label: 'Mark delivered', msg: 'Marked delivered' })
                : null;

        if (!forward && !canReject) return null;

        return (
          <div style={css('position:sticky;bottom:0;background:var(--ag-bg);padding:12px 20px 16px;')}>
            {/* Packing isn't a lifecycle status — it sits between accepted and
                shipped without changing either. It's here so the buyer's
                "Packed" step finally shows a real time instead of a blank. */}
            {o.rawStatus === 'accepted' && !row.packed_at && !confirmReject && (
              <button
                onClick={async () => {
                  try {
                    await markOrderPacked(o.id);
                    showToast('Marked as packed');
                    reload();
                  } catch (e) {
                    showToast(e instanceof Error ? e.message : 'Could not update this order', 'error');
                  }
                }}
                style={css('width:100%;height:42px;margin-bottom:10px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-crimson);border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px;')}
              >
                <span aria-hidden="true" style={css("font-family:'Material Symbols Outlined';font-size:18px;")}>inventory_2</span>
                Mark packed
              </button>
            )}
            {confirmReject ? (
              <div style={css('background:var(--ag-bad-bg);border:1px solid var(--ag-border);border-radius:14px;padding:13px 15px;')}>
                <div style={css('font-size:13px;font-weight:700;color:var(--ag-danger-text);line-height:1.5;')}>
                  Reject this order? This can’t be undone and the payment is refunded. The stock returns to your catalogue.
                </div>
                <div style={css('display:flex;gap:10px;margin-top:11px;')}>
                  <button onClick={() => setConfirmReject(false)} style={css('flex:1;height:48px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-label);border-radius:12px;font-weight:800;cursor:pointer;font-family:inherit;')}>Keep order</button>
                  <button onClick={() => { setConfirmReject(false); setStatus('rejected', 'Order rejected'); }} style={css('flex:1;height:48px;border:none;background:var(--ag-danger-text);color:#fff;border-radius:12px;font-weight:800;cursor:pointer;font-family:inherit;')}>Reject order</button>
                </div>
              </div>
            ) : (
              <div style={css('display:flex;gap:10px;')}>
                {canReject && (
                  <button onClick={() => setConfirmReject(true)} style={css('flex:1;height:52px;border:1.5px solid var(--ag-border);background:var(--ag-surface);color:var(--ag-danger-text);border-radius:14px;font-weight:800;cursor:pointer;font-family:inherit;')}>Reject</button>
                )}
                {forward && (
                  <button className="agx-con-btn"
                    onClick={() => {
                      // Shipping is the one step that needs data first — the
                      // sheet collects it and does the transition itself.
                      if (forward.status === 'shipped') setShipOpen(true);
                      else setStatus(forward.status, forward.msg);
                    }}
                    style={css('flex:1.4;height:52px;border:none;border-radius:14px;color:#fff;font-weight:800;cursor:pointer;font-family:inherit;')}
                  >
                    {forward.label}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {shipOpen && (
        <ShipSheet
          // Remounts when both carriers decline, so the sheet re-opens on the
          // manual form instead of keeping a booking mode that cannot succeed.
          key={manualOnly ? 'manual' : 'book'}
          couriers={couriers ?? []}
          busy={shipping}
          // Every order is prepaid (migration 0085), so every parcel is
          // bookable. A legacy cash order is still excluded: a courier remits
          // collected cash to the account holder — us — which would make the
          // platform the money handler on an order it never took payment for.
          canBook={canBookCourier && !o.isCod && !manualOnly}
          bookCarriers={bookCarriers}
          pickup={pickupInfo ?? undefined}
          cheapest={serviceLane?.cheapest ?? null}
          onCancel={() => setShipOpen(false)}
          onConfirm={shipOrder}
          onBook={bookOrder}
        />
      )}
    </div>
  );
}
