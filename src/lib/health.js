import { Health } from '@capgo/capacitor-health';
import { isNative } from './platform.js';
import { stepBucketsToDaily } from './stats.js';
import { addDays, dateKey, keyToDate } from './dates.js';

const TYPES = ['steps', 'distance', 'calories'];

export async function healthStatus() {
  if (!isNative()) return { available: false, reason: 'Steps are read from Health Connect on the phone app.' };
  try {
    return await Health.isAvailable();
  } catch (err) {
    return { available: false, reason: String(err.message || err) };
  }
}

export async function connectHealth() {
  await Health.requestAuthorization({ read: TYPES });
  const s = await Health.checkAuthorization({ read: TYPES });
  return s;
}

export function openHealthSettings() {
  return Health.openHealthConnectSettings().catch(() => {});
}

async function daily(dataType, days) {
  const start = keyToDate(addDays(dateKey(), -(days - 1)));
  const end = keyToDate(addDays(dateKey(), 1));
  const { samples } = await Health.queryAggregated({
    dataType, startDate: start.toISOString(), endDate: end.toISOString(), bucket: 'day', aggregation: 'sum',
  });
  return stepBucketsToDaily(samples);
}

// Health Connect keeps about 30 days readable; we keep our own copy so history grows.
export async function syncSteps(days = 30) {
  const steps = await daily('steps', days);
  let distance = {};
  let calories = {};
  try { distance = await daily('distance', days); } catch { /* not granted */ }
  try { calories = await daily('calories', days); } catch { /* not granted */ }
  return { steps, distance, calories };
}
