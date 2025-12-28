export type ParsedFilters = {
  q: string;
  driver: "any" | "Yes" | "No" | "Unknown";
  dbs: "any" | "Yes" | "No" | "Unknown";
  training: "any" | "Yes" | "No" | "Unknown";
  status: "any" | "new" | "shortlisted" | "rejected";
  weekend: "any" | "yes" | "no";
};

const YES = new Set(["yes", "y", "true", "confirmed", "has", "with"]);
const NO = new Set(["no", "n", "false", "none", "without", "not"]);

function parseYesNoUnknown(input: string): "any" | "Yes" | "No" | "Unknown" {
  const s = input.toLowerCase().trim();
  if (s === "unknown" || s === "unsure") return "Unknown";
  if (YES.has(s)) return "Yes";
  if (NO.has(s)) return "No";
  return "any";
}

function parseAnyYesNo(input: string): "any" | "yes" | "no" {
  const s = input.toLowerCase().trim();
  if (YES.has(s)) return "yes";
  if (NO.has(s)) return "no";
  return "any";
}

function consumeBoolPhrase(tokens: string[], i: number) {
  const next = tokens[i + 1] ?? "";
  const v = parseYesNoUnknown(next);
  if (v !== "any") return { value: v, consumed: 2 };
  return { value: "any" as const, consumed: 1 };
}

function consumeAnyYesNoPhrase(tokens: string[], i: number) {
  const next = tokens[i + 1] ?? "";
  const v = parseAnyYesNo(next);
  if (v !== "any") return { value: v, consumed: 2 };
  return { value: "any" as const, consumed: 1 };
}

export function parseAISearch(input: string): ParsedFilters {
  const raw = input.trim();
  if (!raw) {
    return { q: "", driver: "any", dbs: "any", training: "any", status: "any", weekend: "any" };
  }

  const cleaned = raw
    .replace(/[.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter(Boolean);

  let driver: ParsedFilters["driver"] = "any";
  let dbs: ParsedFilters["dbs"] = "any";
  let training: ParsedFilters["training"] = "any";
  let status: ParsedFilters["status"] = "any";
  let weekend: ParsedFilters["weekend"] = "any";

  const remaining: string[] = [];

  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i].toLowerCase();

    // Handle "no weekend"
    if ((t === "no" || t === "without") && (tokens[i + 1] ?? "").toLowerCase().startsWith("weekend")) {
      weekend = "no";
      i += 2;
      continue;
    }

    // Status keywords
    if (t === "new") {
      status = "new";
      i += 1;
      continue;
    }
    if (t === "shortlisted" || t === "shortlist") {
      status = "shortlisted";
      i += 1;
      continue;
    }
    if (t === "rejected" || t === "reject") {
      status = "rejected";
      i += 1;
      continue;
    }

    // Weekend filter
    if (t === "weekend" || t === "weekends") {
      const { value, consumed } = consumeAnyYesNoPhrase(tokens, i);
      if (value !== "any") weekend = value as any;
      else weekend = "yes"; // mentioning “weekend” implies yes
      i += consumed;
      continue;
    }
    if (t === "weekday" || t === "weekdays") {
      weekend = "no";
      i += 1;
      continue;
    }
    if (t === "sat" || t === "saturday" || t === "sun" || t === "sunday") {
      weekend = "yes";
      i += 1;
      continue;
    }

    // Driver
    if (t === "driver" || t === "driving") {
      const { value, consumed } = consumeBoolPhrase(tokens, i);
      driver = value as any;
      i += consumed;
      continue;
    }
    if (t === "non-driver" || t === "nondriver") {
      driver = "No";
      i += 1;
      continue;
    }

    // DBS
    if (t === "dbs" || t === "update" || t === "update-service" || t === "updateservice") {
      const { value, consumed } = consumeBoolPhrase(tokens, i);
      if (value !== "any") dbs = value as any;
      i += consumed;
      continue;
    }
    if (t === "no-dbs" || t === "nodb") {
      dbs = "No";
      i += 1;
      continue;
    }

    // Training
    if (t === "training" || t === "mandatory-training" || t === "mandatory") {
      const { value, consumed } = consumeBoolPhrase(tokens, i);
      if (value !== "any") training = value as any;
      i += consumed;
      continue;
    }

    // common shortcuts
    if (t === "energetic" || t === "spinal" || t === "dementia" || t === "complex" || t === "carer" || t === "care") {
      remaining.push(tokens[i]);
      i += 1;
      continue;
    }

    // Default: add to free-text query
    remaining.push(tokens[i]);
    i += 1;
  }

  // Remove tokens that are basically noise
  const noise = new Set(["show", "me", "find", "candidates", "who", "with", "and", "for", "to"]);
  const qTokens = remaining.filter((x) => !noise.has(x.toLowerCase()));
  const q = qTokens.join(" ").trim();

  return { q, driver, dbs, training, status, weekend };
}

export function buildSearchUrl(basePath: string, parsed: ParsedFilters) {
  const params = new URLSearchParams();
  if (parsed.q) params.set("q", parsed.q);
  if (parsed.driver !== "any") params.set("driver", parsed.driver);
  if (parsed.dbs !== "any") params.set("dbs", parsed.dbs);
  if (parsed.training !== "any") params.set("training", parsed.training);
  if (parsed.weekend !== "any") params.set("weekend", parsed.weekend);
  if (parsed.status !== "any") params.set("status", parsed.status);

  // reset paging
  params.set("page", "1");
  params.set("ps", "50");

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
