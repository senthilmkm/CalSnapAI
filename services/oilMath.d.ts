export function finiteOil(value: unknown): number;

export function cookingOilGrams(modelOil: unknown, cookingStyle?: string): number;

export function totalsWithOil(
  baseCalories: number,
  baseFat: number,
  oilGrams: number
): { oilGrams: number; totalCalories: number; totalFat: number };

export function pillForOil(oilGrams: unknown): "raw" | "light" | "heavy" | null;
