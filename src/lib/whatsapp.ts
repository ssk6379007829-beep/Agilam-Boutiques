/** Normalizes a buyer-entered phone number to WhatsApp's `wa.me` format
 *  (country code + number, digits only). Assumes India (+91) when a bare
 *  10-digit number is given, since the app only operates in India today. */
export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits;
}

/** Direct-to-contact WhatsApp deep link — opens a chat with `phone` prefilled with `message`. */
export function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${normalizeIndianPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export type BillItem = { title: string; qty: number; price: number };

export function formatBillMessage(opts: {
  boutiqueName: string;
  boutiquePhone?: string | null;
  billNumber: string;
  date: string;
  buyerName: string;
  items: BillItem[];
  discount?: number;
  total: number;
}): string {
  const { boutiqueName, boutiquePhone, billNumber, date, buyerName, items, discount, total } = opts;
  const lines: string[] = [];
  lines.push(`*${boutiqueName}*`);
  lines.push(`Bill ${billNumber} · ${date}`);
  lines.push('');
  lines.push(`Hi ${buyerName || 'there'}, here's your bill:`);
  lines.push('');
  items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.title} x${it.qty} — ₹${(it.price * it.qty).toLocaleString('en-IN')}`);
  });
  lines.push('');
  if (discount) lines.push(`Discount: -₹${discount.toLocaleString('en-IN')}`);
  lines.push(`*Total: ₹${total.toLocaleString('en-IN')}*`);
  lines.push('');
  lines.push(`Thank you for shopping with ${boutiqueName}!`);
  if (boutiquePhone) lines.push(`Reach us: ${boutiquePhone}`);
  return lines.join('\n');
}
