import { SCHEMA, migrate } from '../store.js';

export function makeBackup(state, now = new Date()) {
  return JSON.stringify({ app: 'daily-hub', schema: SCHEMA, exportedAt: now.toISOString(), data: state }, null, 1);
}

// Returns the migrated state, or throws an Error with a message fit to show the user.
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('This file is not a Daily Hub backup (it is not valid JSON).');
  }
  if (!obj || obj.app !== 'daily-hub' || typeof obj.data !== 'object' || obj.data === null) {
    throw new Error('This file is not a Daily Hub backup.');
  }
  if (typeof obj.schema !== 'number' || obj.schema > SCHEMA) {
    throw new Error('This backup is from a newer version of the app. Please update the app first.');
  }
  const d = obj.data;
  const arrays = [d.todos, d.expenses, d.habits, d.gym?.sessions, d.diet?.log];
  if (arrays.some((a) => a !== undefined && !Array.isArray(a))) {
    throw new Error('This backup file is damaged. Nothing was changed.');
  }
  const bad = (d.expenses || []).some((e) => typeof e.amount !== 'number' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date));
  if (bad) throw new Error('This backup file is damaged. Nothing was changed.');
  return { state: migrate(d), exportedAt: obj.exportedAt };
}

export function backupFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `DailyHub_backup_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}
