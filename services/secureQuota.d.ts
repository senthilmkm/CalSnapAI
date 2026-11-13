export interface MealQuotaRecord {
  day: string;
  count: number;
  lastLogTimestamp: string;
  lastLaunchPaywallDay: string;
  launchPaywallSeen: boolean;
}

export interface QuotaAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface QuotaStoreApi {
  getState(): { mealQuota: MealQuotaRecord; profile: unknown };
  setState(partial: { mealQuota: MealQuotaRecord }): void;
  subscribe(listener: (state: { mealQuota: MealQuotaRecord }, prev: { mealQuota: MealQuotaRecord }) => void): () => void;
  persist?: {
    hasHydrated(): boolean;
    onFinishHydration(callback: () => void): () => void;
  };
}

export function isQuotaReady(): boolean;
export function createSecureStoreAdapter(): QuotaAdapter;
export function restoreMealQuota(options: {
  store: QuotaStoreApi;
  adapter: QuotaAdapter;
  now?: Date;
  timeoutMs?: number;
}): Promise<{ restored: boolean; wrote: boolean; timedOut?: boolean; quota: MealQuotaRecord | null }>;
