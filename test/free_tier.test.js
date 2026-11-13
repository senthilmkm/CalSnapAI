const assert = require('assert');
const {
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
  DEFAULT_DAILY_LIMIT,
} = require('../services/freeTier');
const pricing = require('../config/pricing.json');

const now = new Date(2026, 10, 13, 15, 30, 0);
const today = localDayKey(now);

function quota(partial) {
  return { ...emptyQuota(), ...partial };
}

// localDayKey
assert.strictEqual(localDayKey(now), '2026-11-13');
assert.strictEqual(localDayKey(now.toISOString()), '2026-11-13');

// empty + normalize
assert.deepStrictEqual(emptyQuota(), { day: '', count: 0, lastLogTimestamp: '', lastLaunchPaywallDay: '', launchPaywallSeen: false });
assert.deepStrictEqual(normalizeQuota(null), emptyQuota());
assert.deepStrictEqual(normalizeQuota('nope'), emptyQuota());
assert.strictEqual(normalizeQuota({ count: 'nope' }).count, 0);
assert.strictEqual(normalizeQuota({ count: -4 }).count, 0);
assert.strictEqual(normalizeQuota({ count: 1.9 }).count, 1);
assert.strictEqual(normalizeQuota({ daily_scans_count: 2 }).count, 2);
assert.strictEqual(normalizeQuota({ day: 12, last_scan_date: '2026-11-01' }).day, '2026-11-01');
assert.strictEqual(normalizeQuota({ lastLogTimestamp: 5, last_scan_timestamp: '2026-11-13T12:00:00.000Z' }).lastLogTimestamp, '2026-11-13T12:00:00.000Z');
assert.strictEqual(normalizeQuota({ lastLaunchPaywallDay: 1 }).lastLaunchPaywallDay, '');
assert.strictEqual(normalizeQuota({ launchPaywallSeen: 'yes' }).launchPaywallSeen, false);
assert.strictEqual(normalizeQuota({ launchPaywallSeen: true }).launchPaywallSeen, true);
assert.strictEqual(normalizeQuota({ day: '2026-11-13', lastLaunchPaywallDay: '2026-11-13' }).lastLaunchPaywallDay, '2026-11-13');

// profile mapping
assert.deepStrictEqual(profileToQuota(null), emptyQuota());
assert.strictEqual(profileToQuota('x').count, 0);
assert.strictEqual(profileToQuota({ last_scan_date: today, daily_scans_count: 1, last_scan_timestamp: now.toISOString() }).count, 1);

// effective counts
assert.strictEqual(effectiveLogCount(quota({ day: '2020-01-01', count: 4 }), now), 0);
assert.strictEqual(effectiveLogCount(quota({ day: today, count: 0 }), now), 0);
assert.strictEqual(effectiveLogCount(quota({ day: today, count: 1 }), now), 1);
assert.strictEqual(effectiveLogCount(quota({ day: today, count: 1, lastLogTimestamp: 'not-a-date' }), now), 1);

const futureStamp = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
assert.strictEqual(effectiveLogCount(quota({ day: today, count: 0, lastLogTimestamp: futureStamp }), now), 1);
assert.strictEqual(effectiveLogCount(quota({ day: '2020-01-01', count: 0, lastLogTimestamp: futureStamp }), now), 1);
assert.strictEqual(effectiveLogCount(quota({ day: '2099-01-01', count: 0 }), now), 1);
assert.strictEqual(effectiveLogCount(quota({ day: '2099-01-01', count: 3 }), now), 3);

// just inside the 2 minute skew does not lock
const nearStamp = new Date(now.getTime() + 60 * 1000).toISOString();
assert.strictEqual(effectiveLogCount(quota({ day: today, count: 0, lastLogTimestamp: nearStamp }), now), 0);

assert.strictEqual(displayedLogCount(quota({ day: today, count: 0 }), now, 2), 2);
assert.strictEqual(displayedLogCount(quota({ day: today, count: 1 }), now, 0), 1);
assert.strictEqual(displayedLogCount(quota({ day: today, count: 1 }), now, -3), 1);
assert.strictEqual(displayedLogCount(quota({ day: today, count: 1 }), now, Number.NaN), 1);
assert.strictEqual(displayedLogCount(quota({ day: today, count: 1 }), now, 1.8), 1);

// stricter quota
const ledgerHigh = quota({ day: today, count: 1, lastLogTimestamp: now.toISOString(), lastLaunchPaywallDay: today });
const profileLow = quota({ day: today, count: 0 });
assert.strictEqual(stricterQuota(ledgerHigh, profileLow, now).count, 1);
assert.strictEqual(stricterQuota(profileLow, ledgerHigh, now).count, 1);
assert.strictEqual(stricterQuota(null, null, now).count, 0);

const earlier = quota({ day: today, count: 1, lastLogTimestamp: new Date(now.getTime() - 5000).toISOString() });
const later = quota({ day: today, count: 1, lastLogTimestamp: now.toISOString(), lastLaunchPaywallDay: '2026-11-12' });
assert.strictEqual(stricterQuota(earlier, later, now).lastLogTimestamp, later.lastLogTimestamp);
assert.strictEqual(stricterQuota(earlier, later, now).lastLaunchPaywallDay, '2026-11-12');
assert.strictEqual(stricterQuota(later, earlier, now).lastLogTimestamp, later.lastLogTimestamp);
assert.strictEqual(stricterQuota(quota({ launchPaywallSeen: true }), quota({ launchPaywallSeen: false }), now).launchPaywallSeen, true);
assert.strictEqual(stricterQuota(quota({ launchPaywallSeen: false }), quota({ launchPaywallSeen: true }), now).launchPaywallSeen, true);

const invalidTs = quota({ day: today, count: 1, lastLogTimestamp: 'bogus' });
const validTs = quota({ day: today, count: 1, lastLogTimestamp: now.toISOString() });
assert.strictEqual(stricterQuota(invalidTs, validTs, now).lastLogTimestamp, validTs.lastLogTimestamp);

// delete account cannot drop a used daily log
const sealed = sealQuota(ledgerHigh, { last_scan_date: today, daily_scans_count: 0 }, now);
assert.strictEqual(effectiveLogCount(sealed, now), 1);
const wipedProfile = { last_scan_date: today, daily_scans_count: 0 };
assert.strictEqual(effectiveLogCount(stricterQuota(sealed, profileToQuota(wipedProfile), now), now), 1);
assert.strictEqual(sealQuota(null, { last_scan_date: today, daily_scans_count: 1, last_scan_timestamp: now.toISOString() }, now).count, 1);

// increment
const first = applyIncrement(emptyQuota(), now);
assert.strictEqual(first.count, 1);
assert.strictEqual(first.day, today);
const second = applyIncrement(first, now);
assert.strictEqual(second.count, 2);
const rolled = applyIncrement(quota({ day: '2020-01-02', count: 9, lastLaunchPaywallDay: '2026-11-01' }), now);
assert.strictEqual(rolled.count, 1);
assert.strictEqual(rolled.day, today);
assert.strictEqual(rolled.lastLaunchPaywallDay, '2026-11-01');
const locked = applyIncrement(quota({ day: '2099-01-01', count: 1, lastLogTimestamp: '' }), now);
assert.strictEqual(locked.count, 2);
assert.strictEqual(locked.day, '2099-01-01');
const clockLocked = applyIncrement(quota({ day: '2020-01-01', count: 0, lastLogTimestamp: futureStamp }), now);
assert.ok(clockLocked.count >= 2);

// limits and consume
assert.strictEqual(DEFAULT_DAILY_LIMIT, 1);
assert.strictEqual(dailyLimitFromConfig(pricing), 1);
assert.strictEqual(dailyLimitFromConfig(null), 1);
assert.strictEqual(dailyLimitFromConfig({ free_tier: { daily_snap_limit: 0 } }), 1);
assert.strictEqual(dailyLimitFromConfig({ free_tier: { daily_snap_limit: '3' } }), 3);
assert.strictEqual(dailyLimitFromConfig({ free_tier: { daily_snap_limit: 'no' } }), 1);

assert.deepStrictEqual(canConsume({ isPro: true, quota: first, now, limit: 1 }), { allowed: true, reason: 'pro' });
assert.strictEqual(canConsume({ isPro: false, quota: emptyQuota(), now, limit: 1 }).allowed, true);
assert.strictEqual(canConsume({ isPro: false, quota: first, now, limit: 1 }).reason, 'limit');
assert.strictEqual(canConsume({ quota: emptyQuota(), now, aiMealCount: 1 }).allowed, false);
assert.strictEqual(canConsume({ quota: emptyQuota(), now, limit: 0 }).reason, 'free');
assert.strictEqual(canConsume().allowed, true);

// launch paywall
assert.strictEqual(shouldShowLaunchPaywall(null), false);
assert.strictEqual(shouldShowLaunchPaywall({ isPro: true, today }), false);
assert.strictEqual(shouldShowLaunchPaywall({ isPro: false, onboardingPending: true, today }), false);
assert.strictEqual(shouldShowLaunchPaywall({ isPro: false, onboardingVisible: true, today }), false);
assert.strictEqual(shouldShowLaunchPaywall({ isPro: false, alreadySeen: true, today }), false);
assert.strictEqual(shouldShowLaunchPaywall({ isPro: false, alreadySeen: false, today }), true);

// onboarding paywall
assert.strictEqual(shouldShowPaywallAfterOnboarding(null), false);
assert.strictEqual(shouldShowPaywallAfterOnboarding({ isPro: true, mode: 'intro' }), false);
assert.strictEqual(shouldShowPaywallAfterOnboarding({ isPro: false, mode: 'editor', completed: true, isFirstTime: true }), false);
assert.strictEqual(shouldShowPaywallAfterOnboarding({ isPro: false, mode: 'intro', completed: false, isFirstTime: false }), true);
assert.strictEqual(shouldShowPaywallAfterOnboarding({ isPro: false, completed: true, isFirstTime: true }), true);
assert.strictEqual(shouldShowPaywallAfterOnboarding({ isPro: false, completed: false, isFirstTime: false }), false);
assert.strictEqual(shouldShowPaywallAfterOnboarding({ isPro: false, mode: 'other', completed: true, isFirstTime: false }), false);

// launch stamp
assert.strictEqual(withLaunchPrompt(null, today).lastLaunchPaywallDay, today);
assert.strictEqual(withLaunchPrompt(null, today).launchPaywallSeen, true);
assert.strictEqual(withLaunchPrompt(first, 12).lastLaunchPaywallDay, '');
assert.strictEqual(withLaunchPrompt(first, today).count, 1);

// paywall copy, including the fallback text used before a trial starts
const launchCopy = paywallCopy('launch', pricing);
assert.strictEqual(launchCopy.defaultPlan, 'annual');
assert.ok(launchCopy.detail.includes('1 meal log'));
assert.ok(launchCopy.detail.includes('7-day'));
assert.strictEqual(launchCopy.headline, pricing.free_tier.launch_headline);
const secondCopy = paywallCopy('second_meal', pricing);
assert.ok(secondCopy.headline.length > 0);
assert.ok(secondCopy.subheadline.toLowerCase().includes('trial'));
const featureCopy = paywallCopy('feature', pricing);
assert.strictEqual(featureCopy.subheadline, pricing.paywall_subheadline);
const upgradeCopy = paywallCopy('upgrade', pricing);
assert.strictEqual(upgradeCopy.headline, pricing.paywall_headline);
const unknownCopy = paywallCopy('something-else', null);
assert.strictEqual(unknownCopy.headline, 'Unlock CalSnap AI Pro');
assert.ok(unknownCopy.detail.includes('Cancel anytime'));
assert.strictEqual(unknownCopy.trialDays, 7);
const monthlyOnly = paywallCopy('feature', { monthly: { trial_days: 9 } });
assert.strictEqual(monthlyOnly.trialDays, 9);
assert.ok(monthlyOnly.subheadline.includes('calorie banking'));

// plan labels
assert.strictEqual(getActivePlanLabel(null, pricing), pricing.free_tier.label);
assert.strictEqual(getActivePlanLabel({ is_pro_subscriber: false }, null), 'Free Tier (1 meal log / day)');
assert.ok(getActivePlanLabel({ is_pro_subscriber: true, subscription_tier: 'annual' }, pricing).includes(pricing.annual.display_price));
assert.ok(getActivePlanLabel({ is_pro_subscriber: true, subscription_tier: 'monthly' }, pricing).includes(pricing.monthly.display_price));
assert.strictEqual(getActivePlanLabel({ is_pro_subscriber: true }, pricing), '🎉 Active Plan: CalSnap AI Pro (Unlimited AI Scans)');
assert.ok(getActivePlanLabel({ is_pro_subscriber: true, subscription_tier: 'annual' }, null).includes('$49.99'));
assert.ok(getActivePlanLabel({ is_pro_subscriber: true, subscription_tier: 'monthly' }, {}).includes('$9.99'));

console.log('free tier rules: all branches passed');
