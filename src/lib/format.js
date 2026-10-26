const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatRs(n) {
  const v = Number(n) || 0;
  return `${v < 0 ? '-' : ''}Rs ${inr.format(Math.abs(v))}`;
}

// Short form for tiles and chart labels: 950, 12.5K, 1.25 L, 2.4 Cr
export function formatRsShort(n) {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  const trim = (x) => String(Number(x.toFixed(2)));
  if (v >= 1e7) return `${sign}Rs ${trim(v / 1e7)} Cr`;
  if (v >= 1e5) return `${sign}Rs ${trim(v / 1e5)} L`;
  if (v >= 1e3) return `${sign}Rs ${trim(v / 1e3)}K`;
  return `${sign}Rs ${inr0.format(v)}`;
}

export function formatNum(n) {
  return inr0.format(Math.round(Number(n) || 0));
}

export function formatClock(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatDuration(totalSec) {
  const mins = Math.round(totalSec / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

export function formatKm(meters) {
  return `${(meters / 1000).toFixed(1)} km`;
}

// Parses what people type in an amount box: "1,250", "1250.5", " 300 "
export function parseAmount(text) {
  const v = Number(String(text).replace(/[,\s]/g, ''));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
