import { escapeHtml } from './lib/format.js';
import { tap } from './lib/platform.js';

export const esc = escapeHtml;

// ---------- icons (24px line icons) ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  diet: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  fit: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  money: '<rect x="2" y="6" width="20" height="14" rx="3"/><path d="M2 10h20M16 15h2"/><path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"/>',
  habits: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  play: '<path d="M7 5v14l11-7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 19h14"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  steps: '<path d="M8 20c-2 0-3-1.5-3-3.5S6 13 8 13s2.5 1.5 2.5 3.5S10 20 8 20zM16 11c-2 0-3-1.5-3-3.5S14 4 16 4s2.5 1.5 2.5 3.5S18 11 16 11z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
};

export function icon(name, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;
}

// Gradients referenced by rings and charts, defined once in the page
export const SVG_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient>
<linearGradient id="accentGradV" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2)"/></linearGradient>
<linearGradient id="accentFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient>
</defs></svg>`;

// ---------- rings, bars, charts ----------
const lastPct = new Map();

export function ring(key, pct, { size = 120, stroke = 12, inner = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct || 0));
  const from = lastPct.has(key) ? lastPct.get(key) : 0;
  return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="val" data-ring="${esc(key)}" data-to="${c * (1 - p)}" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - from)}" data-pct="${p}"/>
    </svg><div class="inner">${inner}</div></div>`;
}

export function bar(pct, over = false) {
  const p = Math.max(0, Math.min(1, pct || 0));
  return `<div class="bar ${over ? 'over' : ''}"><i data-w="${(p * 100).toFixed(1)}"></i></div>`;
}

// Bar chart; values array, labels array, optional goal line
// goalIsMax: the goal is a ceiling (e.g. a smoking limit), so bars above it are a warning
export function barChart(values, labels, { height = 130, goal = null, goalIsMax = false, highlight = -1, fmt = (v) => v } = {}) {
  const w = 320;
  const top = 18;
  const bottom = 20;
  const max = Math.max(goal || 0, ...values, 1) * 1.08;
  const n = values.length;
  const slot = w / n;
  const bw = Math.min(26, slot * 0.62);
  const ch = height - top - bottom;
  let s = `<svg class="chart" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none">`;
  values.forEach((v, i) => {
    const h = Math.max(v > 0 ? 3 : 0, (v / max) * ch);
    const x = i * slot + (slot - bw) / 2;
    const cls = v <= 0 ? 'b dim' : goalIsMax && goal != null && v > goal ? 'b over'
      : (!goalIsMax && goal && v >= goal) || i === highlight ? 'b hit' : 'b';
    s += `<rect class="${cls} grow-bar" style="animation-delay:${i * 25}ms" x="${x}" y="${top + ch - h}" width="${bw}" height="${Math.max(h, 3)}" rx="${Math.min(7, bw / 2)}"/>`;
    if (labels[i]) s += `<text class="lbl" x="${x + bw / 2}" y="${height - 5}">${esc(labels[i])}</text>`;
    if (i === highlight && v > 0) s += `<text class="lbl" style="font-weight:700;fill:var(--text)" x="${x + bw / 2}" y="${top + ch - h - 5}">${esc(fmt(v))}</text>`;
  });
  if (goal) {
    const y = top + ch - (goal / max) * ch;
    s += `<line class="goal" x1="0" x2="${w}" y1="${y}" y2="${y}"/>`;
  }
  return s + '</svg>';
}

export function lineChart(points, { height = 140, fmt = (v) => v } = {}) {
  if (points.length < 2) return '<div class="empty small">Log at least two entries to see a trend.</div>';
  const w = 320;
  const pad = 20;
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v) => 16 + (1 - (v - lo) / span) * (height - 44);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  let s = `<svg class="chart" viewBox="0 0 ${w} ${height}">`;
  s += `<path class="area" d="${d} L${x(points.length - 1)},${height - 24} L${x(0)},${height - 24} Z"/>`;
  s += `<path class="line" d="${d}"/>`;
  points.forEach((p, i) => {
    if (points.length <= 14 || i === 0 || i === points.length - 1) s += `<circle class="dot" cx="${x(i)}" cy="${y(p.v)}" r="4"/>`;
  });
  s += `<text class="lbl" x="${x(0)}" y="${height - 6}">${esc(points[0].label)}</text>`;
  s += `<text class="lbl" x="${x(points.length - 1)}" y="${height - 6}">${esc(points[points.length - 1].label)}</text>`;
  s += `<text class="lbl" style="font-weight:700;fill:var(--text)" x="${x(points.length - 1)}" y="${y(vals[vals.length - 1]) - 9}">${esc(fmt(vals[vals.length - 1]))}</text>`;
  return s + '</svg>';
}

// GitHub-style heatmap: keys oldest..newest (multiple of 7, Monday first), level 0-3
export function heatmap(cells) {
  return `<div class="heat">${cells.map((c) => `<i class="l${c.level} ${c.today ? 'today' : ''} ${c.future ? 'future' : ''}"></i>`).join('')}</div>`;
}

// ---------- after-render animations ----------
const lastCount = new Map();

export function animateIn(root) {
  requestAnimationFrame(() => {
    root.querySelectorAll('[data-ring]').forEach((el) => {
      el.style.strokeDashoffset = el.dataset.to;
      lastPct.set(el.dataset.ring, Number(el.dataset.pct));
    });
    root.querySelectorAll('.bar > i[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; });
  });
  root.querySelectorAll('[data-count]').forEach((el) => {
    const key = el.dataset.key || el.dataset.count;
    const to = Number(el.dataset.count);
    const from = lastCount.has(key) ? lastCount.get(key) : 0;
    lastCount.set(key, to);
    const fmt = COUNT_FMT[el.dataset.fmt] || COUNT_FMT.num;
    if (from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const dur = 700;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const COUNT_FMT = {
  num: (v) => inr0.format(Math.round(v)),
  rs: (v) => `Rs ${inr0.format(Math.round(v))}`,
  dec: (v) => (Math.round(v * 10) / 10).toFixed(1),
};

export function count(key, value, fmt = 'num') {
  const f = COUNT_FMT[fmt];
  const shown = lastCount.has(key) ? lastCount.get(key) : 0;
  return `<span data-count="${value}" data-key="${esc(key)}" data-fmt="${fmt}">${f(shown)}</span>`;
}

// ---------- sheets ----------
const sheets = [];

export function openSheet({ title, html, onMount, onClose }) {
  tap();
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="grab"><i></i></div>
    <div class="head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
    <div class="body"></div>`;
  const body = el.querySelector('.body');
  document.body.append(backdrop, el);
  const entry = { el, backdrop, onClose };
  sheets.push(entry);
  const close = () => closeSheet(entry);
  entry.close = close;
  const setBody = (h) => { body.innerHTML = h; };
  setBody(typeof html === 'function' ? html() : html);
  requestAnimationFrame(() => { backdrop.classList.add('show'); el.classList.add('show'); });
  backdrop.addEventListener('click', close);
  el.querySelector('[data-close]').addEventListener('click', close);

  // drag the handle down to dismiss
  const grab = el.querySelector('.grab');
  let y0 = null;
  grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; el.style.transition = 'none'; grab.setPointerCapture(e.pointerId); });
  grab.addEventListener('pointermove', (e) => { if (y0 !== null) el.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  grab.addEventListener('pointerup', (e) => {
    const dy = e.clientY - y0;
    y0 = null;
    el.style.transition = '';
    el.style.transform = '';
    if (dy > 90) close();
  });

  const api = { el, body, close, setBody };
  if (onMount) onMount(api);
  return api;
}

function closeSheet(entry) {
  const i = sheets.indexOf(entry);
  if (i < 0) return;
  sheets.splice(i, 1);
  entry.el.classList.remove('show');
  entry.backdrop.classList.remove('show');
  setTimeout(() => { entry.el.remove(); entry.backdrop.remove(); }, 380);
  if (entry.onClose) entry.onClose();
}

export function closeTopSheet() {
  const top = sheets[sheets.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function closeAllSheets() {
  while (sheets.length) sheets[sheets.length - 1].close();
}

export function confirmSheet({ title, message, confirm = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = openSheet({
      title,
      html: `<p class="muted" style="margin:0 0 18px">${esc(message)}</p>
        <div class="row"><button class="btn plain" style="flex:1" data-no>Cancel</button>
        <button class="btn ${danger ? 'danger' : ''}" style="flex:1" data-yes>${esc(confirm)}</button></div>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    s.body.querySelector('[data-no]').onclick = () => { answered = true; resolve(false); s.close(); };
    s.body.querySelector('[data-yes]').onclick = () => { answered = true; resolve(true); s.close(); };
  });
}

// ---------- toast ----------
let toastEl = null;
let toastTimer = null;

export function toast(message, { action, onAction, ms = 3500 } = {}) {
  if (toastEl) toastEl.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  document.body.append(el);
  toastEl = el;
  requestAnimationFrame(() => el.classList.add('show'));
  if (action) el.querySelector('button').onclick = () => { onAction(); hide(); };
  const hide = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
    if (toastEl === el) toastEl = null;
  };
  toastTimer = setTimeout(hide, ms);
}

// ---------- swipe on list items ----------
// Items marked data-swipe="id" get swipe-right (onRight) and swipe-left (onLeft).
export function enableSwipe(root, handlers) {
  let cur = null;
  root.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('[data-swipe]');
    if (!item || e.target.closest('button, input, textarea')) return;
    cur = { item, x0: e.clientX, y0: e.clientY, dx: 0, locked: null, fg: item.querySelector('.swipe-fg') || item };
  });
  root.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const dx = e.clientX - cur.x0;
    const dy = e.clientY - cur.y0;
    if (cur.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) cur.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (cur.locked !== 'x') return;
    if ((dx > 0 && !handlers.onRight) || (dx < 0 && !handlers.onLeft)) return;
    cur.dx = dx;
    cur.fg.style.transition = 'none';
    cur.fg.style.transform = `translateX(${dx}px)`;
    const bgR = cur.item.querySelector('.swipe-bg.right');
    const bgL = cur.item.querySelector('.swipe-bg.left');
    if (bgR) bgR.style.opacity = dx > 0 ? Math.min(1, dx / 90) : 0;
    if (bgL) bgL.style.opacity = dx < 0 ? Math.min(1, -dx / 90) : 0;
  });
  const end = () => {
    if (!cur) return;
    const { item, dx, fg } = cur;
    cur = null;
    fg.style.transition = '';
    const id = item.dataset.swipe;
    if (dx > 90 && handlers.onRight) {
      fg.style.transform = '';
      handlers.onRight(id, item);
    } else if (dx < -90 && handlers.onLeft) {
      fg.style.transform = 'translateX(-110%)';
      setTimeout(() => handlers.onLeft(id, item), 180);
    } else {
      fg.style.transform = '';
    }
    item.querySelectorAll('.swipe-bg').forEach((b) => { b.style.opacity = 0; });
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
}

export function swipeItem(id, inner, { right = '✓ Done', left = 'Delete', cls = '' } = {}) {
  return `<div class="item ${cls}" data-swipe="${esc(id)}">
    ${right ? `<div class="swipe-bg right">${right}</div>` : ''}${left ? `<div class="swipe-bg left">${left} 🗑</div>` : ''}
    <div class="swipe-fg">${inner}</div></div>`;
}

// ---------- confetti ----------
export function confetti() {
  const c = document.createElement('canvas');
  c.className = 'confetti';
  c.width = innerWidth * devicePixelRatio;
  c.height = innerHeight * devicePixelRatio;
  document.body.append(c);
  const ctx = c.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const colors = [css.getPropertyValue('--accent'), css.getPropertyValue('--accent-2'), '#facc15', '#22c55e', '#f43f5e'];
  const parts = Array.from({ length: 120 }, () => ({
    x: c.width / 2, y: c.height * 0.45,
    vx: (Math.random() - 0.5) * 26 * devicePixelRatio, vy: (Math.random() * -22 - 6) * devicePixelRatio,
    s: (4 + Math.random() * 6) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    col: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (t) => {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of parts) {
      p.vy += 0.7 * devicePixelRatio; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.col;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (t - t0 < 2200) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

// ---------- small helpers ----------
export function onAct(root, actions) {
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = actions[el.dataset.act];
    if (fn) {
      tap();
      fn(el.dataset.id, el, e);
    }
  });
}

export const EMOJIS = ['💧', '📖', '😴', '🥗', '🏃', '🧘', '🏋️', '🚶', '🧠', '✍️', '🎸', '🙏', '☀️', '🦷', '💊', '🚭',
  '📵', '🧹', '💰', '🍎', '🥛', '🌱', '🎯', '❤️', '🐕', '🎨', '📚', '🛌', '🚴', '🏊', '⚽', '🧑‍💻'];

// Full-screen trophy moment for a personal record
export function prBurst(title, detail) {
  const el = document.createElement('div');
  el.className = 'pr-burst';
  el.innerHTML = `<div class="box"><div class="trophy">🏆</div><div class="t1">NEW PR!</div>
    <div class="t2">${esc(title)}</div><div class="t2">${esc(detail)}</div></div>`;
  document.body.append(el);
  confetti();
  setTimeout(() => el.classList.add('out'), 2200);
  setTimeout(() => el.remove(), 2700);
}
