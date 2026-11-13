/**
 * Keeps the free-meal quota in the iOS keychain so a reinstall
 * does not hand the day back. The keychain read is guarded: a failure
 * never wipes a saved quota, and logging waits until the read finishes.
 */

const { emptyQuota, normalizeQuota, sealQuota, stricterQuota } = require('./freeTier');

const QUOTA_KEY = 'calsnap_meal_quota';
const DEFAULT_TIMEOUT_MS = 1500;

let quotaReady = false;
let quotaWritesEnabled = false;
let watchingWrites = false;
let restoreInFlight = null;

function isQuotaReady() {
  return quotaReady;
}

function areQuotaWritesEnabled() {
  return quotaWritesEnabled;
}

function markQuotaReady() {
  quotaReady = true;
}

function enableQuotaWrites() {
  quotaWritesEnabled = true;
}

function resetQuotaSyncForTests() {
  quotaReady = false;
  quotaWritesEnabled = false;
  watchingWrites = false;
  restoreInFlight = null;
}

function parseStoredQuota(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function serializeQuota(quota) {
  const q = normalizeQuota(quota);
  return JSON.stringify({
    day: q.day,
    count: q.count,
    lastLogTimestamp: q.lastLogTimestamp,
    lastLaunchPaywallDay: q.lastLaunchPaywallDay,
    launchPaywallSeen: q.launchPaywallSeen === true,
  });
}

function mergeDeviceAndLocal(deviceQuota, localQuota, profile, now) {
  const device = deviceQuota == null ? emptyQuota() : normalizeQuota(deviceQuota);
  const local = normalizeQuota(localQuota);
  return sealQuota(stricterQuota(device, local, now), profile, now);
}

function loadSecureStore(loader) {
  const load = typeof loader === 'function' ? loader : defaultLoadSecureStore;
  try {
    const mod = load();
    if (!mod || typeof mod.getItemAsync !== 'function' || typeof mod.setItemAsync !== 'function') {
      return null;
    }
    return mod;
  } catch {
    return null;
  }
}

function defaultLoadSecureStore() {
  return require('expo-secure-store');
}

function createSecureStoreAdapter(loader) {
  const mod = loadSecureStore(loader);
  if (!mod) {
    return {
      async getItem() {
        return null;
      },
      async setItem() {
        return undefined;
      },
    };
  }
  return {
    async getItem(key) {
      return mod.getItemAsync(key);
    },
    async setItem(key, value) {
      await mod.setItemAsync(key, value);
    },
  };
}

async function readDeviceQuota(store, timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timer;
  try {
    const raw = await Promise.race([
      store.getItem(QUOTA_KEY),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('quota-read-timeout')), timeoutMs);
      }),
    ]);
    clearTimeout(timer);
    const parsed = parseStoredQuota(raw);
    if (parsed == null) {
      return { ok: true, quota: emptyQuota() };
    }
    return { ok: true, quota: normalizeQuota(parsed) };
  } catch {
    clearTimeout(timer);
    return { ok: false, quota: null };
  }
}

async function writeDeviceQuota(store, quota) {
  if (!quotaWritesEnabled) return false;
  try {
    await store.setItem(QUOTA_KEY, serializeQuota(quota));
    return true;
  } catch {
    return false;
  }
}

function waitForStoreHydration(storeApi) {
  if (!storeApi.persist || storeApi.persist.hasHydrated()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      if (typeof unsub === 'function') unsub();
      resolve();
    };
    const unsub = storeApi.persist.onFinishHydration(done);
    if (storeApi.persist.hasHydrated()) done();
  });
}

function watchQuotaWrites(storeApi, store) {
  if (watchingWrites) return;
  watchingWrites = true;
  storeApi.subscribe((state, prev) => {
    if (!quotaWritesEnabled) return;
    if (!prev || state.mealQuota === prev.mealQuota) return;
    writeDeviceQuota(store, state.mealQuota);
  });
}

function restoreMealQuota(options) {
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = runRestore(options).finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}

async function runRestore(options) {
  const storeApi = options.store;
  const adapter = options.adapter;
  const now = options.now instanceof Date ? options.now : new Date();
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;

  let timedOut = false;
  let timer;
  try {
    const work = (async () => {
      const [deviceResult] = await Promise.all([
        readDeviceQuota(adapter, timeoutMs),
        waitForStoreHydration(storeApi),
      ]);
      if (timedOut && quotaReady) {
        return { restored: false, wrote: false, quota: null };
      }
      if (!deviceResult.ok) {
        markQuotaReady();
        return { restored: false, wrote: false, quota: null };
      }
      const state = storeApi.getState();
      const merged = mergeDeviceAndLocal(deviceResult.quota, state.mealQuota, state.profile, now);
      watchQuotaWrites(storeApi, adapter);
      enableQuotaWrites();
      storeApi.setState({ mealQuota: merged });
      const wrote = await writeDeviceQuota(adapter, merged);
      markQuotaReady();
      return { restored: true, wrote, quota: merged };
    })();

    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve({ restored: false, wrote: false, timedOut: true, quota: null });
      }, timeoutMs);
    });

    const outcome = await Promise.race([work, timeout]);
    if (!outcome.timedOut) {
      clearTimeout(timer);
    }
    if (outcome && outcome.timedOut) {
      work.then(() => {
        markQuotaReady();
      }).catch(() => {
        markQuotaReady();
      });
    }
    return outcome;
  } catch {
    clearTimeout(timer);
    markQuotaReady();
    return { restored: false, wrote: false, quota: null };
  }
}

module.exports = {
  QUOTA_KEY,
  DEFAULT_TIMEOUT_MS,
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
};
