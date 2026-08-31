/**
 * GSTIN shape.
 *
 * 15 characters: two state-code digits, the holder's PAN (five letters, four
 * digits, one letter), an entity number, a literal 'Z', and a checksum
 * character. This proves the number is well-FORMED and nothing else — there is
 * no offline way to tell an invented-but-valid-looking GSTIN from a real one,
 * which is why the verification queue treats a passing GSTIN as neutral rather
 * than as evidence (see src/lib/boutiqueReview.ts).
 *
 * Lives here because two screens apply it — the seller setup wizard as it is
 * typed, and the admin review drawer on what was stored — and a second copy
 * would eventually accept what the first rejects.
 */
export const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
