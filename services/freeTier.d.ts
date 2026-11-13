export interface MealQuota {
  day: string;
  count: number;
  lastLogTimestamp: string;
  lastLaunchPaywallDay: string;
  launchPaywallSeen: boolean;
}

export type PaywallReason = 'launch' | 'second_meal' | 'feature' | 'upgrade';

export interface ConsumeResult {
  allowed: boolean;
  reason: 'pro' | 'free' | 'limit';
  count?: number;
}

export interface PaywallCopy {
  headline: string;
  subheadline: string;
  detail: string;
  trialDays: number;
  defaultPlan: 'annual';
}

export function localDayKey(date: Date): string;
export function emptyQuota(): MealQuota;
export function normalizeQuota(raw: unknown): MealQuota;
export function profileToQuota(profile: unknown): MealQuota;
export function effectiveLogCount(quota: unknown, now: Date): number;
export function displayedLogCount(quota: unknown, now: Date, aiMealCount: number): number;
export function stricterQuota(ledger: unknown, profileQuota: unknown, now: Date): MealQuota;
export function sealQuota(ledger: unknown, profile: unknown, now: Date): MealQuota;
export function applyIncrement(quota: unknown, now: Date): MealQuota;
export function dailyLimitFromConfig(config: unknown): number;
export function canConsume(params: {
  isPro?: boolean;
  quota?: unknown;
  now?: Date;
  limit?: number;
  aiMealCount?: number;
}): ConsumeResult;
export function shouldShowLaunchPaywall(params: {
  isPro?: boolean;
  onboardingPending?: boolean;
  onboardingVisible?: boolean;
  alreadySeen?: boolean;
}): boolean;
export function shouldShowPaywallAfterOnboarding(params: {
  isPro?: boolean;
  mode?: 'intro' | 'editor' | string;
  completed?: boolean;
  isFirstTime?: boolean;
}): boolean;
export function withLaunchPrompt(quota: unknown, today: string): MealQuota;
export function paywallCopy(reason: string, config: unknown): PaywallCopy;
export function getActivePlanLabel(profile: unknown, config: unknown): string;
