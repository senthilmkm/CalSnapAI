export function summarizeDayStability(meals: Array<{ glucose_impact_score?: string; energy_crash_risk?: string }> | null): {
  hasMeals: boolean;
  glucose: string;
  crash: string;
  calm: boolean;
};

export function describeDayStability(meals: Array<{ glucose_impact_score?: string; energy_crash_risk?: string }> | null): {
  tone: "empty" | "calm" | "caution";
  text: string;
};
