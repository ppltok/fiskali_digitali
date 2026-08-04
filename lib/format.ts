// he-IL number formatting — ₪ figures are first-class typographic citizens.

const nf_full = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const nf_frac = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Hebrew convention: number first, then unit, then ₪ — "83.9 מיליארד ₪".
export function formatShekels(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${nf_frac.format(value / 1e9)} מיליארד ₪`;
  if (abs >= 1e6) return `${nf_frac.format(value / 1e6)} מיליון ₪`;
  if (abs >= 1e3) return `${nf_full.format(value)} ₪`;
  return `${nf_frac.format(value)} ₪`;
}

// Axis scale: charts divide by one shared unit and state it once in the header.
export function axisUnit(max_abs: number): { divisor: number; label: string } {
  if (max_abs >= 1e9) return { divisor: 1e9, label: 'מיליארדי ₪' };
  if (max_abs >= 1e6) return { divisor: 1e6, label: 'מיליוני ₪' };
  if (max_abs >= 1e3) return { divisor: 1e3, label: 'אלפי ₪' };
  return { divisor: 1, label: '₪' };
}

export function formatAxisTick(value: number, divisor: number): string {
  const scaled = value / divisor;
  return Number.isInteger(scaled) ? nf_full.format(scaled) : nf_frac.format(scaled);
}

export function formatNumber(value: number): string {
  return nf_full.format(value);
}
