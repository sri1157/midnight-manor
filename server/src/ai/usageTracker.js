import { PROVIDERS } from './providers.js';

const SAFETY = 0.9;      // use only 90% of each limit
const MINUTE = 60_000;

const usage = new Map(); // providerId -> { recent: [timestamps], day: 'YYYY-MM-DD', today: number }

const utcDay = (ts = Date.now()) => new Date(ts).toISOString().slice(0, 10);
const cap = (limit) => (limit == null ? Infinity : Math.max(1, Math.floor(limit * SAFETY)));

function msUntilUtcMidnight() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}

function getUsageRecord(id) {
  let u = usage.get(id);
  const day = utcDay();
  if (!u) {
    u = { recent: [], day, today: 0 };
    usage.set(id, u);
  }
  if (u.day !== day) {           // new UTC day: reset the daily count
    u.day = day;
    u.today = 0;
  }
  const cutoff = Date.now() - MINUTE;
  while (u.recent.length && u.recent[0] <= cutoff) u.recent.shift(); // slide the window
  return u;
}

/** Can we send one more request to this provider right now? */
export function checkQuota(id) {
  const limits = PROVIDERS[id]?.limits ?? {};
  const u = getUsageRecord(id);

  if (u.today >= cap(limits.rpd)) {
    return { ok: false, reason: 'daily_quota', retryInMs: msUntilUtcMidnight() };
  }
  if (u.recent.length >= cap(limits.rpm)) {
    return { ok: false, reason: 'minute_quota', retryInMs: u.recent[0] + MINUTE - Date.now() };
  }
  return { ok: true };
}

/** Count a request (call this before every attempt, failed ones count too). */
export function recordRequest(id) {
  const u = getUsageRecord(id);
  u.recent.push(Date.now());
  u.today += 1;
}

/** Snapshot for the debug panel and tests. */
export function getUsage() {
  return Object.keys(PROVIDERS).map((id) => {
    const u = getUsageRecord(id);
    const limits = PROVIDERS[id].limits ?? {};
    return {
      provider: id,
      lastMinute: u.recent.length,
      minuteCap: cap(limits.rpm),
      today: u.today,
      dailyCap: cap(limits.rpd),
    };
  });
}

export function resetUsage() {
  usage.clear();
}
