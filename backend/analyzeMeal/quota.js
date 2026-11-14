const QUOTA_CLEANUP_LIMIT = 25000;

function dayKey(now) {
  return now.toISOString().split("T")[0];
}

function quotaMapKey(userId, now) {
  return `${userId}:${dayKey(now)}`;
}

function dailySnapLimit(rawLimit) {
  const parsed = parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function canUseDailySnap(map, userId, isPro, now, limit) {
  if (isPro) return true;
  return (map.get(quotaMapKey(userId, now)) || 0) < limit;
}

function recordDailySnap(map, userId, isPro, now, cleanupLimit = QUOTA_CLEANUP_LIMIT) {
  if (isPro) return;
  const day = dayKey(now);
  const key = quotaMapKey(userId, now);
  map.set(key, (map.get(key) || 0) + 1);
  if (map.size > cleanupLimit) {
    for (const [entry] of map.entries()) {
      if (!String(entry).endsWith(day)) {
        map.delete(entry);
      }
    }
  }
}

module.exports = {
  QUOTA_CLEANUP_LIMIT,
  dayKey,
  quotaMapKey,
  dailySnapLimit,
  canUseDailySnap,
  recordDailySnap,
};
