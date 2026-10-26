import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './platform.js';

const CHANNEL = 'reminders';

// Notification id ranges, so each kind can be cancelled and rebuilt on its own
const ID = { water: 1000, habits: 2000, gym: 2100, diet: 2200, bills: 3000, focus: 9001, rest: 9002 };
const MANAGED_MAX = 8999;

export async function setupNotifications() {
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL, name: 'Reminders', description: 'Water, habits, gym, bills and timers',
      importance: 4, visibility: 1, vibration: true,
    });
  } catch (err) {
    console.error('[reminders] channel', err);
  }
}

export async function ensurePermission() {
  if (!isNative()) return false;
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
  return p.display === 'granted';
}

export async function exactAlarmStatus() {
  if (!isNative()) return 'granted';
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm;
  } catch {
    return 'granted';
  }
}

export async function openExactAlarmSettings() {
  if (isNative()) await LocalNotifications.changeExactNotificationSetting();
}

const daily = (id, hhmm, title, body) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  return { id, title, body, channelId: CHANNEL, schedule: { on: { hour, minute }, allowWhileIdle: true } };
};

// Rebuilds every repeating reminder from settings. Safe to call often.
export async function syncReminders(state) {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id < MANAGED_MAX);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });

    const r = state.settings.reminders;
    const list = [];
    if (r.water.on) {
      for (let h = r.water.start; h <= r.water.end; h += Math.max(1, r.water.everyHours)) {
        list.push({
          id: ID.water + h, title: '💧 Water time', body: 'Have a glass of water and tap + in the Diet tab.',
          channelId: CHANNEL, schedule: { on: { hour: h, minute: 0 }, allowWhileIdle: true },
        });
      }
    }
    if (r.habits.on) list.push(daily(ID.habits, r.habits.time, '✅ Habit check-in', 'Tick off today\'s habits before the day ends.'));
    if (r.gym.on) list.push(daily(ID.gym, r.gym.time, '🏋️ Gym time', 'Your workout is waiting. Open Daily Hub to start it.'));
    if (r.diet.on) list.push(daily(ID.diet, r.diet.time, '🥗 Log your meals', 'Add what you ate so far to keep your protein on track.'));
    if (r.bills.on) {
      state.bills.forEach((b, i) => {
        list.push({
          id: ID.bills + i, title: `💡 ${b.name} is due today`,
          body: b.amount ? `Rs ${Number(b.amount).toLocaleString('en-IN')} to be paid today.` : 'Payment due today.',
          channelId: CHANNEL, schedule: { on: { day: b.dueDay, hour: 9, minute: 0 }, allowWhileIdle: true },
        });
      });
    }
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch (err) {
    console.error('[reminders] sync failed', err);
  }
}

export async function scheduleTimer(kind, at, title, body) {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID[kind] }] });
    await LocalNotifications.schedule({
      notifications: [{ id: ID[kind], title, body, channelId: CHANNEL, schedule: { at, allowWhileIdle: true } }],
    });
  } catch (err) {
    console.error('[reminders] timer', err);
  }
}

export async function cancelTimer(kind) {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: ID[kind] }] });
  } catch {
    // nothing pending
  }
}

export async function testNotification() {
  if (!isNative()) return false;
  if (!(await ensurePermission())) return false;
  await LocalNotifications.schedule({
    notifications: [{
      id: 8999, title: '🔔 Test reminder', body: 'Reminders are working. You can close the app and they will still come.',
      channelId: CHANNEL, schedule: { at: new Date(Date.now() + 60_000), allowWhileIdle: true },
    }],
  });
  return true;
}
