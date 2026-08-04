// he-IL number formatting — ₪ figures are first-class typographic citizens.

const nf_full = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const nf_frac = new Intl.NumberFormat('he-IL', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatShekels(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `₪${nf_frac.format(value / 1e9)} מיליארד`;
  if (abs >= 1e6) return `₪${nf_frac.format(value / 1e6)} מיליון`;
  if (abs >= 1e3) return `₪${nf_full.format(value)}`;
  return `₪${nf_frac.format(value)}`;
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${nf_frac.format(value / 1e9)} מלרד׳`;
  if (abs >= 1e6) return `${nf_frac.format(value / 1e6)} מלן׳`;
  if (abs >= 1e3) return `${nf_full.format(Math.round(value / 1e3))} אלף`;
  return nf_full.format(value);
}

export function formatNumber(value: number): string {
  return nf_full.format(value);
}
