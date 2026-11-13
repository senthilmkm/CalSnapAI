const assert = require('assert');
const { test } = require('node:test');
const {
  QUOTA_KEY,
  isQuotaReady,
  areQuotaWritesEnabled,
  markQuotaReady,
  enableQuotaWrites,
  resetQuotaSyncForTests,
  parseStoredQuota,
  serializeQuota,
  mergeDeviceAndLocal,
  loadSecureStore,
  createSecureStoreAdapter,
  readDeviceQuota,
  writeDeviceQuota,
  waitForStoreHydration,
  watchQuotaWrites,
  restoreMealQuota,
} = require('../services/secureQuota');

const now = new Date(2026, 10, 13, 15, 0, 0);
const today = '2026-11-13';

function savedQuota(count, extra = {}) {
  return {
    day: today,
    count,
    lastLogTimestamp: now.toISOString(),
    lastLaunchPaywallDay: '',
    launchPaywallSeen: false,
    ...extra,
  };
}

function memoryStore(initial) {
  let state = {
    mealQuota: savedQuota(0, { day: '', count: 0, lastLogTimestamp: '' }),
    profile: { last_scan_date: today, daily_scans_count: 0 },
    ...initial,
  };
  const listeners = [];
  let hydrated = true;
  let hydrationCallback = null;
  return {
    getState: () => state,
    setState: (partial) => {
      const prev = state;
      state = { ...state, ...partial };
      listeners.forEach((listener) => listener(state, prev));
    },
    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    persist: {
      hasHydrated: () => hydrated,
      onFinishHydration: (callback) => {
        hydrationCallback = callback;
        return () => {
          hydrationCallback = null;
        };
      },
      setHydrated(value) {
        hydrated = value;
      },
      finish() {
        hydrated = true;
        if (hydrationCallback) hydrationCallback();
      },
    },
  };
}

function memoryAdapter(initial) {
  let value = initial === undefined ? null : initial;
  const calls = [];
  return {
    calls,
    async getItem() {
      return value;
    },
    async setItem(key, next) {
      calls.push({ key, next });
      value = next;
    },
    current() {
      return value;
    },
  };
}

function reset() {
  resetQuotaSyncForTests();
}

// parse
reset();
assert.strictEqual(parseStoredQuota(null), null);
assert.strictEqual(parseStoredQuota(''), null);
assert.strictEqual(parseStoredQuota('   '), null);
assert.strictEqual(parseStoredQuota('{'), null);
assert.strictEqual(parseStoredQuota('null'), null);
assert.strictEqual(parseStoredQuota('[]'), null);
assert.strictEqual(parseStoredQuota('"text"'), null);
assert.deepStrictEqual(parseStoredQuota(JSON.stringify(savedQuota(1))).count, 1);

// serialize
const serial = serializeQuota({ count: 1.8, day: today, launchPaywallSeen: 1 });
assert.strictEqual(JSON.parse(serial).count, 1);
assert.strictEqual(JSON.parse(serial).launchPaywallSeen, false);
assert.strictEqual(JSON.parse(serializeQuota(savedQuota(1, { launchPaywallSeen: true }))).launchPaywallSeen, true);

// reinstall: phone storage is empty, keychain still has today's meal
const reinstall = mergeDeviceAndLocal(
  savedQuota(1, { launchPaywallSeen: true }),
  { day: '', count: 0, lastLogTimestamp: '', lastLaunchPaywallDay: '', launchPaywallSeen: false },
  { last_scan_date: today, daily_scans_count: 0 },
  now
);
assert.strictEqual(reinstall.count, 1);
assert.strictEqual(reinstall.launchPaywallSeen, true);

const localWins = mergeDeviceAndLocal(savedQuota(0), savedQuota(1), { daily_scans_count: 0, last_scan_date: today }, now);
assert.strictEqual(localWins.count, 1);
assert.strictEqual(mergeDeviceAndLocal(null, null, null, now).count, 0);

// loader
assert.strictEqual(loadSecureStore(() => { throw new Error('missing native module'); }), null);
assert.strictEqual(loadSecureStore(() => null), null);
assert.strictEqual(loadSecureStore(() => ({ getItemAsync() {} })), null);
assert.strictEqual(loadSecureStore(() => ({})), null);
assert.strictEqual(loadSecureStore(() => ({ setItemAsync() {} })), null);
const native = {
  async getItemAsync(key) { return `got:${key}`; },
  async setItemAsync() { return undefined; },
};
assert.strictEqual(loadSecureStore(() => native), native);
const fallback = loadSecureStore();
assert.ok(fallback === null || typeof fallback.getItemAsync === 'function');

test('keychain meal quota survives reinstall', async () => {
const missingAdapter = createSecureStoreAdapter(() => null);
assert.strictEqual(await missingAdapter.getItem(QUOTA_KEY), null);
assert.strictEqual(await missingAdapter.setItem(QUOTA_KEY, '{}'), undefined);
const liveAdapter = createSecureStoreAdapter(() => native);
assert.strictEqual(await liveAdapter.getItem('calsnap_meal_quota'), 'got:calsnap_meal_quota');
await liveAdapter.setItem('calsnap_meal_quota', '{}');

// read
const readable = memoryAdapter(JSON.stringify(savedQuota(1)));
assert.strictEqual((await readDeviceQuota(readable, 50)).quota.count, 1);
assert.deepStrictEqual((await readDeviceQuota(memoryAdapter(null), 50)).quota.count, 0);
assert.strictEqual((await readDeviceQuota(memoryAdapter('{'), 50)).ok, true);
assert.deepStrictEqual(await readDeviceQuota({ async getItem() { throw new Error('keychain down'); } }, 50), { ok: false, quota: null });
const hung = await readDeviceQuota({ getItem: () => new Promise(() => {}) }, 20);
assert.deepStrictEqual(hung, { ok: false, quota: null });

// write guard
reset();
const writer = memoryAdapter(null);
assert.strictEqual(await writeDeviceQuota(writer, savedQuota(1)), false);
assert.strictEqual(writer.calls.length, 0);
enableQuotaWrites();
assert.strictEqual(areQuotaWritesEnabled(), true);
assert.strictEqual(await writeDeviceQuota(writer, savedQuota(1)), true);
assert.strictEqual(writer.calls[0].key, QUOTA_KEY);
assert.strictEqual(await writeDeviceQuota({ async setItem() { throw new Error('full'); } }, savedQuota(1)), false);

// hydration wait
await waitForStoreHydration({});
await waitForStoreHydration({ persist: { hasHydrated: () => true, onFinishHydration() { return () => {}; } } });
const waiting = memoryStore();
waiting.persist.setHydrated(false);
let finished = false;
const pendingHydration = waitForStoreHydration(waiting).then(() => { finished = true; });
waiting.persist.finish();
waiting.persist.finish();
await pendingHydration;
assert.strictEqual(finished, true);

// watch
reset();
const watched = memoryStore();
const watchAdapter = memoryAdapter(null);
watchQuotaWrites(watched, watchAdapter);
watchQuotaWrites(watched, watchAdapter);
watched.setState({ mealQuota: savedQuota(1) });
assert.strictEqual(watchAdapter.calls.length, 0);
enableQuotaWrites();
watched.setState({ mealQuota: savedQuota(1) });
await new Promise((resolve) => setImmediate(resolve));
assert.strictEqual(watchAdapter.calls.length, 1);
const same = watched.getState().mealQuota;
watched.setState({ mealQuota: same });
await new Promise((resolve) => setImmediate(resolve));
assert.strictEqual(watchAdapter.calls.length, 1);

// restore keeps the keychain meal after a reinstall
reset();
const restoredStore = memoryStore({
  mealQuota: savedQuota(0, { day: '', count: 0, lastLogTimestamp: '' }),
  profile: { last_scan_date: today, daily_scans_count: 0 },
});
const restoredAdapter = memoryAdapter(JSON.stringify(savedQuota(1, { launchPaywallSeen: true })));
const restored = await restoreMealQuota({
  store: restoredStore,
  adapter: restoredAdapter,
  now,
  timeoutMs: 200,
});
assert.strictEqual(restored.restored, true);
assert.strictEqual(restored.wrote, true);
assert.strictEqual(restoredStore.getState().mealQuota.count, 1);
assert.strictEqual(isQuotaReady(), true);
assert.strictEqual(JSON.parse(restoredAdapter.current()).count, 1);

// a failed keychain read must not overwrite the phone quota
reset();
const kept = memoryStore({ mealQuota: savedQuota(1) });
const failed = await restoreMealQuota({
  store: kept,
  adapter: { getItem: async () => { throw new Error('locked'); }, setItem: async () => { throw new Error('no'); } },
  now,
  timeoutMs: 200,
});
assert.strictEqual(failed.restored, false);
assert.strictEqual(failed.wrote, false);
assert.strictEqual(kept.getState().mealQuota.count, 1);
assert.strictEqual(isQuotaReady(), true);

// timeout releases the splash wait, then the late keychain result still applies
reset();
const lateStore = memoryStore();
lateStore.persist.setHydrated(false);
const lateAdapter = memoryAdapter(JSON.stringify(savedQuota(1)));
const lateOutcome = await restoreMealQuota({
  store: lateStore,
  adapter: lateAdapter,
  now,
  timeoutMs: 30,
});
assert.strictEqual(lateOutcome.timedOut, true);
assert.strictEqual(isQuotaReady(), false);
lateStore.persist.finish();
await new Promise((resolve) => setTimeout(resolve, 30));
assert.strictEqual(isQuotaReady(), true);
assert.strictEqual(lateStore.getState().mealQuota.count, 1);

// a second arrival after the quota is already ready does not write over it
reset();
markQuotaReady();
const already = memoryStore();
already.persist.setHydrated(false);
const alreadyAdapter = memoryAdapter(JSON.stringify(savedQuota(1)));
const alreadyOutcome = await restoreMealQuota({
  store: already,
  adapter: alreadyAdapter,
  now,
  timeoutMs: 20,
});
assert.strictEqual(alreadyOutcome.timedOut, true);
already.persist.finish();
await new Promise((resolve) => setTimeout(resolve, 30));
assert.strictEqual(already.getState().mealQuota.count, 0);
assert.strictEqual(alreadyAdapter.calls.length, 0);

reset();
const defaults = memoryStore();
const defaultsResult = await restoreMealQuota({
  store: defaults,
  adapter: memoryAdapter(null),
  now: 'today',
});
assert.strictEqual(defaultsResult.restored, true);
assert.strictEqual(defaultsResult.timedOut, undefined);

await waitForStoreHydration({});
let flipped = false;
await waitForStoreHydration({
  persist: {
    hasHydrated: () => flipped,
    onFinishHydration() {
      flipped = true;
      return () => {};
    },
  },
});
const looseHydration = waitForStoreHydration({
  persist: {
    hasHydrated: () => false,
    onFinishHydration(callback) {
      setTimeout(callback, 0);
    },
  },
});
await looseHydration;

let savedCallback;
const doubleStore = {
  persist: {
    hasHydrated: () => false,
    onFinishHydration(callback) {
      savedCallback = callback;
      return () => {};
    },
  },
};
const doubleWait = waitForStoreHydration(doubleStore);
savedCallback();
savedCallback();
await doubleWait;

reset();
const bareAdapter = memoryAdapter(null);
enableQuotaWrites();
watchQuotaWrites({
  subscribe(listener) {
    listener({ mealQuota: savedQuota(1) }, undefined);
    return () => {};
  },
}, bareAdapter);
await new Promise((resolve) => setImmediate(resolve));
assert.strictEqual(bareAdapter.calls.length, 0);

const extraListener = memoryStore();
const detach = extraListener.subscribe(() => {});
detach();
detach();

reset();
const exploding = memoryStore();
exploding.persist.setHydrated(false);
exploding.getState = () => {
  throw new Error('state unavailable');
};
const explosion = await restoreMealQuota({
  store: exploding,
  adapter: memoryAdapter(JSON.stringify(savedQuota(1))),
  now,
  timeoutMs: 25,
});
assert.strictEqual(explosion.timedOut, true);
exploding.persist.finish();
await new Promise((resolve) => setTimeout(resolve, 40));
assert.strictEqual(isQuotaReady(), true);

reset();
const broken = memoryStore();
broken.getState = () => {
  throw new Error('state unavailable');
};
const brokenAdapter = memoryAdapter(JSON.stringify(savedQuota(1)));
const brokenResult = await restoreMealQuota({
  store: broken,
  adapter: brokenAdapter,
  now,
  timeoutMs: 500,
});
assert.deepStrictEqual(brokenResult, { restored: false, wrote: false, quota: null });
assert.strictEqual(isQuotaReady(), true);
assert.strictEqual(brokenAdapter.calls.length, 0);

reset();
let releaseRead;
const shared = memoryStore();
let sharedReads = 0;
let sharedWrites = 0;
const sharedAdapter = {
  async getItem() {
    sharedReads += 1;
    await new Promise((resolve) => {
      releaseRead = resolve;
    });
    return JSON.stringify(savedQuota(1));
  },
  async setItem() {
    sharedWrites += 1;
  },
};
const firstRestore = restoreMealQuota({ store: shared, adapter: sharedAdapter, now, timeoutMs: 2000 });
const secondRestore = restoreMealQuota({ store: shared, adapter: sharedAdapter, now, timeoutMs: 2000 });
assert.strictEqual(firstRestore, secondRestore);
releaseRead();
const sharedResult = await firstRestore;
assert.strictEqual(sharedResult.restored, true);
assert.strictEqual(sharedResult.quota.count, 1);
assert.strictEqual(sharedReads, 1);
assert.strictEqual(sharedWrites, 2);

});
