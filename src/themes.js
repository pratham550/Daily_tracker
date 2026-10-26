// Each theme is an accent pair; the light/dark/AMOLED surfaces are derived from it in CSS.
export const THEMES = [
  { id: 'indigo', name: 'Midnight', a: '#6366f1', b: '#a855f7', on: '#ffffff' },
  { id: 'ocean', name: 'Ocean', a: '#0891b2', b: '#3b82f6', on: '#ffffff' },
  { id: 'saffron', name: 'Saffron', a: '#f97316', b: '#facc15', on: '#1c1206' },
  { id: 'forest', name: 'Forest', a: '#059669', b: '#84cc16', on: '#ffffff' },
  { id: 'rose', name: 'Rose', a: '#e11d48', b: '#f472b6', on: '#ffffff' },
  { id: 'sunset', name: 'Sunset', a: '#db2777', b: '#f97316', on: '#ffffff' },
  { id: 'mint', name: 'Mint', a: '#14b8a6', b: '#22c55e', on: '#04201c' },
  { id: 'graphite', name: 'Graphite', a: '#475569', b: '#94a3b8', on: '#ffffff' },
];

export const MODES = [
  { id: 'auto', name: 'Auto', icon: '🌗' },
  { id: 'light', name: 'Light', icon: '☀️' },
  { id: 'dark', name: 'Dark', icon: '🌙' },
  { id: 'amoled', name: 'Black', icon: '⚫' },
];

const media = window.matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(settings) {
  const t = THEMES.find((x) => x.id === settings.theme) || THEMES[0];
  const root = document.documentElement;
  const dark = settings.mode === 'dark' || settings.mode === 'amoled' || (settings.mode === 'auto' && media.matches);
  root.dataset.mode = settings.mode === 'amoled' ? 'amoled' : dark ? 'dark' : 'light';
  root.style.setProperty('--accent', t.a);
  root.style.setProperty('--accent-2', t.b);
  root.style.setProperty('--on-accent', t.on);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim() || t.a;
}

export function watchSystemTheme(getSettings) {
  media.addEventListener('change', () => applyTheme(getSettings()));
}
