import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { update, getState, uid } from '../store.js';
import { dateKey, monthKey, addMonths, fmtMonth, fmtDay, daysInMonth } from '../lib/dates.js';
import { formatRs, formatRsShort, parseAmount } from '../lib/format.js';
import { monthSummary, expensesToCsv } from '../lib/stats.js';
import { syncReminders } from '../lib/reminders.js';
import { isNative, success } from '../lib/platform.js';
import { esc, icon, ring, bar, count, barChart, swipeItem, openSheet, confirmSheet, toast } from '../ui.js';

let ym = null;
const viewMonth = () => ym || monthKey(dateKey());

export function render(s) {
  const m = viewMonth();
  const today = dateKey();
  const isCurrent = m === monthKey(today);
  const sum = monthSummary(s.expenses, m);
  const budget = s.settings.budget;
  const cat = Object.fromEntries(s.categories.map((c) => [c.id, c]));
  const todayDay = Number(today.slice(8, 10));
  const daysGone = isCurrent ? todayDay : sum.days;
  const perDay = daysGone ? sum.total / daysGone : 0;
  const projected = isCurrent ? Math.round(perDay * sum.days) : sum.total;
  const left = budget - sum.total;

  const hero = `<div class="card hero">
    <div class="row" style="gap:16px">
      <div style="flex:1;min-width:0">
        <div class="muted small">Spent in ${fmtMonth(m)}</div>
        <div class="big-num">${count('money-total', sum.total, 'rs')}</div>
        <div class="muted small" style="margin-top:4px">${left >= 0 ? `${formatRs(left)} left of ${formatRsShort(budget)}` : `${formatRs(-left)} over budget`}</div>
      </div>
      ${ring('money-budget', sum.total / budget, { size: 92, stroke: 10, inner: `<b>${Math.round((sum.total / budget) * 100)}%</b>` })}
    </div>
    <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
      <span class="badge">📆 ${formatRsShort(perDay)}/day</span>
      ${isCurrent ? `<span class="badge">📈 On track for ${formatRsShort(projected)}</span>` : ''}
    </div></div>`;

  const cats = Object.entries(sum.byCategory).sort((a, b) => b[1] - a[1]);
  const catCard = `<div class="card"><h2>📊 Where it went</h2>${cats.length ? cats.map(([id, v]) => {
    const c = cat[id] || { emoji: '📦', name: id };
    return `<div style="margin-bottom:12px"><div class="row between small" style="margin-bottom:6px"><span>${c.emoji} <b>${esc(c.name)}</b></span>
      <span>${formatRs(v)} <span class="muted">· ${Math.round((v / sum.total) * 100)}%</span></span></div>${bar(v / cats[0][1])}</div>`;
  }).join('') : '<div class="empty small">No spends this month yet.</div>'}</div>`;

  const labels = sum.byDay.map((_, i) => ((i + 1) % 5 === 0 || i === 0 ? String(i + 1) : ''));
  const daily = `<div class="card"><h2>📅 Day by day</h2>${barChart(sum.byDay, labels, { highlight: isCurrent ? todayDay - 1 : -1, fmt: formatRsShort })}</div>`;

  const items = s.expenses.filter((e) => monthKey(e.date) === m).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const groups = {};
  for (const e of items) (groups[e.date] ||= []).push(e);
  const list = `<div class="card"><h2>🧾 Spends</h2>${items.length ? Object.entries(groups).map(([d, arr]) => `
      <div class="row between small muted" style="margin:12px 4px 6px"><b>${fmtDay(d)}</b><span>${formatRs(arr.reduce((a, e) => a + e.amount, 0))}</span></div>
      <div class="list">${arr.map((e) => {
        const c = cat[e.category] || { emoji: '📦', name: e.category };
        return swipeItem(e.id, `<span class="emoji">${c.emoji}</span><span class="grow"><span class="title">${esc(e.note || c.name)}</span>
          <span class="meta">${esc(c.name)}</span></span><b>${formatRs(e.amount)}</b>`, { right: null });
      }).join('')}</div>`).join('') + '<p class="hint">Swipe left to delete</p>'
    : '<div class="empty"><span class="big">💸</span>Tap + to log your first spend.</div>'}</div>`;

  const dim = daysInMonth(monthKey(today));
  const daysTo = (b) => (b.dueDay - todayDay + dim) % dim;
  const bills = [...s.bills].sort((a, b) => daysTo(a) - daysTo(b));
  const billCard = `<div class="card"><h2>💡 Monthly bills <span class="spacer"></span><button class="btn ghost small" data-act="bill">+ Bill</button></h2>
    ${bills.length ? `<div class="list">${bills.map((b) => `
      <button class="item pressable" style="text-align:left" data-act="bill" data-id="${b.id}">
        <span class="emoji">🗓️</span><span class="grow"><span class="title">${esc(b.name)}</span>
        <span class="meta">Due on ${b.dueDay} every month${b.amount ? ` · ${formatRs(b.amount)}` : ''}</span></span>
        <span class="badge ${daysTo(b) <= 3 ? 'warn' : ''}">${daysTo(b) === 0 ? 'Today' : `in ${daysTo(b)} d`}</span></button>`).join('')}</div>`
    : '<div class="empty small">Add rent, EMI, phone, electricity… and get a reminder on the due day.</div>'}</div>`;

  return `<header class="top"><div class="grow"><h1>Money 💰</h1><div class="sub">${fmtMonth(m)}</div></div>
      <button class="icon-btn" data-act="prev" aria-label="Previous month">${icon('left')}</button>
      <button class="icon-btn" data-act="next" aria-label="Next month" ${isCurrent ? 'disabled style="opacity:.4"' : ''}>${icon('right')}</button></header>
    ${hero}${catCard}${daily}${list}${billCard}
    <button class="btn plain block" data-act="csv">⬇️ Export ${fmtMonth(m)} to Excel (CSV)</button>`;
}

export function openAddExpense() {
  const s = getState();
  const st = { cat: s.categories[0].id };
  const sheet = openSheet({
    title: 'Add spend',
    html: `<input class="input amount-input" id="amt" inputmode="decimal" placeholder="Rs 0">
      <div class="chips wrap" style="margin:14px 0">${s.categories.map((c) => `<button class="chip ${c.id === st.cat ? 'on' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`).join('')}</div>
      <label class="field"><span>Note (optional)</span><input class="input" id="note" placeholder="e.g. Chai with team"></label>
      <label class="field"><span>Date</span><input class="input" id="date" type="date" value="${dateKey()}" max="${dateKey()}"></label>
      <button class="btn block" data-save>Save spend</button>`,
  });
  const amt = sheet.body.querySelector('#amt');
  setTimeout(() => amt.focus(), 350);
  sheet.body.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) {
      st.cat = c.dataset.cat;
      sheet.body.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('on', x === c));
      return;
    }
    if (!e.target.closest('[data-save]')) return;
    const amount = parseAmount(amt.value);
    if (!amount) { toast('Please enter the amount'); amt.focus(); return; }
    const date = sheet.body.querySelector('#date').value || dateKey();
    const note = sheet.body.querySelector('#note').value.trim();
    update((x) => { x.expenses.push({ id: uid(), amount, category: st.cat, note, date, createdAt: Date.now() }); });
    success();
    sheet.close();
    const after = monthSummary(getState().expenses, monthKey(date)).total;
    const budget = getState().settings.budget;
    if (monthKey(date) === monthKey(dateKey()) && after > budget && after - amount <= budget) {
      toast(`⚠️ You just crossed your monthly budget of ${formatRsShort(budget)}`, { ms: 5000 });
    } else {
      toast(`Saved ${formatRs(amount)}`);
    }
  });
}

function openBill(id) {
  const s = getState();
  const b = s.bills.find((x) => x.id === id) || { name: '', amount: '', dueDay: 1 };
  const sheet = openSheet({
    title: id ? 'Edit bill' : 'New bill',
    html: `<label class="field"><span>Bill name</span><input class="input" id="b-name" value="${esc(b.name)}" placeholder="e.g. Rent, Phone, EMI"></label>
      <div class="row" style="gap:10px">
        <label class="field" style="flex:1"><span>Amount (optional)</span><input class="input" id="b-amt" inputmode="decimal" value="${b.amount || ''}" placeholder="Rs"></label>
        <label class="field" style="flex:1"><span>Due day (1-28)</span><input class="input" id="b-day" inputmode="numeric" value="${b.dueDay}"></label></div>
      <p class="hint" style="margin-bottom:14px">You get a reminder at 9 am on the due day, if bill reminders are on in Settings.</p>
      <div class="row">${id ? '<button class="btn danger" data-del>Delete</button>' : ''}<button class="btn" style="flex:1" data-save>Save</button></div>`,
  });
  sheet.body.addEventListener('click', async (e) => {
    if (e.target.closest('[data-save]')) {
      const name = sheet.body.querySelector('#b-name').value.trim();
      const day = Math.round(Number(sheet.body.querySelector('#b-day').value));
      if (!name) { toast('Please enter a bill name'); return; }
      if (!(day >= 1 && day <= 28)) { toast('Due day must be between 1 and 28'); return; }
      const amount = parseAmount(sheet.body.querySelector('#b-amt').value);
      update((x) => {
        if (id) Object.assign(x.bills.find((y) => y.id === id), { name, amount, dueDay: day });
        else x.bills.push({ id: uid(), name, amount, dueDay: day });
      });
      syncReminders(getState());
      sheet.close();
    }
    if (e.target.closest('[data-del]')) {
      if (!(await confirmSheet({ title: 'Delete bill?', message: `${b.name} and its reminder will be removed.` }))) return;
      update((x) => { x.bills = x.bills.filter((y) => y.id !== id); });
      syncReminders(getState());
      sheet.close();
    }
  });
}

async function exportCsv() {
  const s = getState();
  const m = viewMonth();
  const rows = s.expenses.filter((e) => monthKey(e.date) === m);
  if (!rows.length) { toast('No spends in this month to export'); return; }
  const csv = '﻿' + expensesToCsv(rows, s.categories); // BOM so Excel opens it as UTF-8
  const name = `DailyHub_spends_${m.replace('-', '')}.csv`;
  try {
    if (isNative()) {
      const { uri } = await Filesystem.writeFile({ path: name, data: csv, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: name, files: [uri] });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  } catch (err) {
    if (!String(err.message || err).toLowerCase().includes('cancel')) toast('Export failed: ' + (err.message || err));
  }
}

export const actions = {
  prev(_, __, ___, ctx) { ym = addMonths(viewMonth(), -1); ctx.render(); },
  next(_, __, ___, ctx) {
    const cur = monthKey(dateKey());
    if (viewMonth() === cur) return;
    ym = addMonths(viewMonth(), 1);
    if (ym === cur) ym = null;
    ctx.render();
  },
  bill: (id) => openBill(id),
  csv: () => exportCsv(),
};

export const swipe = {
  left(id) {
    const s = getState();
    const i = s.expenses.findIndex((e) => e.id === id);
    if (i < 0) return;
    const copy = s.expenses[i];
    update((st) => { st.expenses.splice(i, 1); });
    toast(`Deleted ${formatRs(copy.amount)}`, { action: 'Undo', onAction: () => update((st) => { st.expenses.splice(i, 0, copy); }) });
  },
};

export function fab() {
  return () => openAddExpense();
}
