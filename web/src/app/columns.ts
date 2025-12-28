export const ALLOWED_COLS = ["phone", "roles", "tags", "badges", "last_called", "actions"] as const;
export type AllowedCol = (typeof ALLOWED_COLS)[number];

export const DEFAULT_COLS: AllowedCol[] = ["phone", "roles", "tags", "badges", "last_called", "actions"];

export function parseColsParam(raw: unknown): AllowedCol[] {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return DEFAULT_COLS;

  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  const set = new Set(parts);

  const result: AllowedCol[] = [];
  for (const k of ALLOWED_COLS) if (set.has(k)) result.push(k);

  return result.length ? result : DEFAULT_COLS;
}

export function colsToParam(cols: AllowedCol[]): string {
  const set = new Set(cols);
  return ALLOWED_COLS.filter((c) => set.has(c)).join(",");
}
