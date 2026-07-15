export const TONES = ['#F4D6E2', '#F1DCC7', '#E2DAEF', '#D7E7DE', '#F3DFD0', '#E7D9E6', '#DCE4EF', '#F0DAD4'];

export function toneHex(tone: number) {
  return TONES[tone % TONES.length];
}

export function fmtInr(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function initial(name: string) {
  return (name?.trim()?.[0] ?? '?').toUpperCase();
}

type StatusStyle = { bg: string; fg: string };

export function statusStyle(status: string): StatusStyle {
  const map: Record<string, StatusStyle> = {
    Pending: { bg: '#FBF0DA', fg: '#B8860B' },
    Shipped: { bg: '#E6F0FA', fg: '#3A6EA5' },
    Delivered: { bg: '#E5F3EC', fg: '#218456' },
    Approved: { bg: '#E5F3EC', fg: '#218456' },
    Active: { bg: '#E5F3EC', fg: '#218456' },
    Live: { bg: '#E5F3EC', fg: '#218456' },
    Settled: { bg: '#E5F3EC', fg: '#218456' },
    Due: { bg: '#FBF0DA', fg: '#B8860B' },
    Paused: { bg: '#FBF0DA', fg: '#B8860B' },
    Rejected: { bg: '#FBE3E3', fg: '#C0392B' },
    Expired: { bg: '#FBE3E3', fg: '#C0392B' },
    Draft: { bg: '#F1E4EB', fg: '#8A7078' },
  };
  return map[status] || { bg: '#F1E4EB', fg: '#8A7078' };
}

export function stockInfo(stock: number) {
  if (stock === 0) return { label: 'Out of stock', bg: '#FBE3E3', fg: '#D6455A' };
  if (stock <= 5) return { label: `Low · ${stock} left`, bg: '#FBF0DA', fg: '#C99A3F' };
  return { label: 'In stock', bg: '#E5F3EC', fg: '#2FA36B' };
}
