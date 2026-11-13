/**
 * Free-tier meal log rules.
 * One daily log is shared by photo snaps, barcodes, quick add, and staples.
 * The quota record lives outside the profile so account deletion cannot reset it.
 */

const CLOCK_SKEW_MS = 120000;
const DEFAULT_DAILY_LIMIT = 1;

function localDayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function emptyQuota() {
  return {
    day: '',
    count: 0,
    lastLogTimestamp: '',
    lastLaunchPaywallDay: '',
    launchPaywallSeen: false,
  };
}

function readCount(raw) {
  const source = raw.count !== undefined && raw.count !== null ? raw.count : raw.daily_scans_count;
  const n = Number(source);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizeQuota(raw) {
  if (!raw || typeof raw !== 'object') return emptyQuota();
  const daySource = typeof raw.day === 'string' ? raw.day : raw.last_scan_date;
  const timestampSource = typeof raw.lastLogTimestamp === 'string' ? raw.lastLogTimestamp : raw.last_scan_timestamp;
  return {
    day: typeof daySource === 'string' ? daySource : '',
    count: readCount(raw),
    lastLogTimestamp: typeof timestampSource === 'string' ? timestampSource : '',
    lastLaunchPaywallDay: typeof raw.lastLaunchPaywallDay === 'string' ? raw.lastLaunchPaywallDay : '',
    launchPaywallSeen: raw.launchPaywallSeen === true,
  };
}

function profileToQuota(profile) {
  if (!profile || typeof profile !== 'object') return emptyQuota();
  return normalizeQuota({
    day: profile.last_scan_date,
    count: profile.daily_scans_count,
    lastLogTimestamp: profile.last_scan_timestamp,
  });
}

function timestampMs(value) {
  if (!value) return NaN;
  return new Date(value).getTime();
}

function isClockRolledBack(quota, nowMs) {
  const last = timestampMs(quota.lastLogTimestamp);
  if (Number.isNaN(last)) return false;
  return nowMs < last - CLOCK_SKEW_MS;
}

function isFutureDay(quota, today) {
  return Boolean(quota.day) && quota.day > today;
}

function effectiveLogCount(quota, now) {
  const q = normalizeQuota(quota);
  const today = localDayKey(now);
  const nowMs = now.getTime();
  if (isClockRolledBack(q, nowMs)) return Math.max(1, q.count || 1);
  if (isFutureDay(q, today)) return Math.max(1, q.count || 1);
  if (q.day !== today) return 0;
  return q.count;
}

function displayedLogCount(quota, now, aiMealCount) {
  const ai = Number(aiMealCount);
  const safeAi = Number.isFinite(ai) && ai > 0 ? Math.floor(ai) : 0;
  return Math.max(effectiveLogCount(quota, now), safeAi);
}

function stricterQuota(ledger, profileQuota, now) {
  const a = normalizeQuota(ledger);
  const b = normalizeQuota(profileQuota);
  const aCount = effectiveLogCount(a, now);
  const bCount = effectiveLogCount(b, now);
  let chosen = a;
  if (bCount > aCount) {
    chosen = b;
  } else if (aCount === bCount) {
    const aTs = timestampMs(a.lastLogTimestamp);
    const bTs = timestampMs(b.lastLogTimestamp);
    const aSafe = Number.isNaN(aTs) ? 0 : aTs;
    const bSafe = Number.isNaN(bTs) ? 0 : bTs;
    chosen = bSafe > aSafe ? b : a;
  }
  return {
    day: chosen.day,
    count: chosen.count,
    lastLogTimestamp: chosen.lastLogTimestamp,
    lastLaunchPaywallDay: a.lastLaunchPaywallDay || b.lastLaunchPaywallDay || '',
    launchPaywallSeen: a.launchPaywallSeen === true || b.launchPaywallSeen === true,
  };
}

function sealQuota(ledger, profile, now) {
  return stricterQuota(ledger, profileToQuota(profile), now);
}

function applyIncrement(quota, now) {
  const q = normalizeQuota(quota);
  const today = localDayKey(now);
  const nowMs = now.getTime();
  const iso = now.toISOString();
  if (isClockRolledBack(q, nowMs) || isFutureDay(q, today)) {
    return {
      ...q,
      count: Math.max(1, q.count || 1) + 1,
      lastLogTimestamp: q.lastLogTimestamp || iso,
    };
  }
  const base = q.day === today ? q.count : 0;
  return {
    ...q,
    day: today,
    count: base + 1,
    lastLogTimestamp: iso,
  };
}

function dailyLimitFromConfig(config) {
  const raw = config && config.free_tier ? config.free_tier.daily_snap_limit : undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_DAILY_LIMIT;
  return Math.floor(n);
}

function canConsume(params) {
  const isPro = Boolean(params && params.isPro);
  if (isPro) return { allowed: true, reason: 'pro' };
  const now = params && params.now instanceof Date ? params.now : new Date();
  const limit = params && Number.isFinite(Number(params.limit)) ? Math.floor(Number(params.limit)) : DEFAULT_DAILY_LIMIT;
  const safeLimit = limit < 1 ? DEFAULT_DAILY_LIMIT : limit;
  const count = displayedLogCount(params ? params.quota : null, now, params ? params.aiMealCount : 0);
  if (count >= safeLimit) return { allowed: false, reason: 'limit', count };
  return { allowed: true, reason: 'free', count };
}

function shouldShowLaunchPaywall(params) {
  if (!params || params.isPro) return false;
  if (params.onboardingPending) return false;
  if (params.onboardingVisible) return false;
  if (params.alreadySeen) return false;
  return true;
}

function shouldShowPaywallAfterOnboarding(params) {
  if (!params || params.isPro) return false;
  if (params.mode === 'editor') return false;
  if (params.mode === 'intro') return true;
  return Boolean(params.completed && params.isFirstTime);
}

function withLaunchPrompt(quota, today) {
  const q = normalizeQuota(quota);
  return {
    ...q,
    lastLaunchPaywallDay: typeof today === 'string' ? today : '',
    launchPaywallSeen: true,
  };
}

function paywallCopy(reason, config) {
  const days = (config && config.annual && config.annual.trial_days) || (config && config.monthly && config.monthly.trial_days) || 7;
  const free = (config && config.free_tier) || {};
  const detail = free.limit_detail || 'Free includes 1 meal log each day. That can be a photo snap, a barcode, a quick add, or a staple. Logging another meal today starts a 7-day free trial. You pay nothing today. Cancel anytime before the trial ends.';
  const library = {
    launch: {
      headline: free.launch_headline || 'One free meal a day',
      subheadline: free.launch_subheadline || 'Photo, barcode, quick add, and staples share that one daily meal. The 7-day trial logs the rest of your day.',
    },
    second_meal: {
      headline: free.second_meal_headline || "Today's free meal is used",
      subheadline: free.second_meal_subheadline || 'Your next photo, barcode, quick add, or staple starts the 7-day free trial. You will not be charged today.',
    },
    feature: {
      headline: free.feature_headline || 'This unlocks with the 7-day trial',
      subheadline: (config && config.paywall_subheadline) || 'Zero-friction food logging, weekly calorie banking, and interactive oil sliders.',
    },
    upgrade: {
      headline: (config && config.paywall_headline) || 'Unlock CalSnap AI Pro',
      subheadline: (config && config.paywall_subheadline) || 'Zero-friction food logging, weekly calorie banking, and interactive oil sliders.',
    },
  };
  const chosen = library[reason] || library.upgrade;
  return {
    headline: chosen.headline,
    subheadline: chosen.subheadline,
    detail,
    trialDays: days,
    defaultPlan: 'annual',
  };
}

function displayPrice(config, tier) {
  const fallback = tier === 'annual' ? '$49.99' : '$9.99';
  if (!config || !config[tier] || !config[tier].display_price) return fallback;
  return config[tier].display_price;
}

function getActivePlanLabel(profile, config) {
  if (!profile || !profile.is_pro_subscriber) {
    return (config && config.free_tier && config.free_tier.label) || 'Free Tier (1 meal log / day)';
  }
  if (profile.subscription_tier === 'annual') {
    return `🎉 Active Plan: CalSnap AI Pro Annual (${displayPrice(config, 'annual')}/year)`;
  }
  if (profile.subscription_tier === 'monthly') {
    return `🎉 Active Plan: CalSnap AI Pro Monthly (${displayPrice(config, 'monthly')}/month)`;
  }
  return '🎉 Active Plan: CalSnap AI Pro (Unlimited AI Scans)';
}

module.exports = {
  CLOCK_SKEW_MS,
  DEFAULT_DAILY_LIMIT,
  localDayKey,
  emptyQuota,
  normalizeQuota,
  profileToQuota,
  effectiveLogCount,
  displayedLogCount,
  stricterQuota,
  sealQuota,
  applyIncrement,
  dailyLimitFromConfig,
  canConsume,
  shouldShowLaunchPaywall,
  shouldShowPaywallAfterOnboarding,
  withLaunchPrompt,
  paywallCopy,
  getActivePlanLabel,
};
