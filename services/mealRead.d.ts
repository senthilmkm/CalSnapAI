export const SNAP_WAIT_MS: number;

export function interpretMealResponse(
  status: number,
  body: { success?: boolean; data?: unknown } | null
): { type: "quota" } | { type: "retry" } | { type: "meal"; data: any };
