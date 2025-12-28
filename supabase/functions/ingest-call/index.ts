/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-ingest-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function meaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false;

  if (typeof v === "string") {
    const t = v.trim();
    return t !== "" && t !== "Unknown";
  }

  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as any).length > 0;

  return true;
}

/**
 * Normalize UK-focused phone numbers into E.164 without external libs.
 * Accepts:
 *  - +447... (already E.164)
 *  - 00447... -> +447...
 *  - 447... -> +447...
 *  - 07... -> +447...
 *  - 7XXXXXXXXX (10 digits starting with 7) -> +44...
 */
function normalizePhoneE164(rawInput: unknown): string | null {
  if (rawInput === null || rawInput === undefined) return null;

  let raw = String(rawInput).trim();
  if (!raw) return null;

  // keep digits and leading plus; strip spaces, dashes, brackets, etc.
  raw = raw.replace(/[^\d+]/g, "");

  // 00... -> +...
  if (raw.startsWith("00")) raw = "+" + raw.slice(2);

  // If already +E.164
  if (raw.startsWith("+")) {
    if (/^\+\d{7,15}$/.test(raw)) return raw;
    return null;
  }

  // Digits-only from here
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // UK local 07... -> +44...
  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 12) {
    const e164 = "+44" + digits.slice(1);
    if (/^\+\d{7,15}$/.test(e164)) return e164;
  }

  // Already country code without +
  if (digits.startsWith("44") && digits.length >= 9 && digits.length <= 15) {
    const e164 = "+" + digits;
    if (/^\+\d{7,15}$/.test(e164)) return e164;
  }

  // Sometimes Dialpad/Zapier gives mobile without 0: 7XXXXXXXXX (10 digits)
  if (digits.length === 10 && digits.startsWith("7")) {
    const e164 = "+44" + digits;
    if (/^\+\d{7,15}$/.test(e164)) return e164;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // 1) Validate shared secret
    const ingestKey = req.headers.get("x-ingest-key")?.trim();
    if (!ingestKey) return json(401, { error: "Missing x-ingest-key" });

    // 2) Create admin Supabase client (service role)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 3) Resolve org_id by matching SHA-256 hash of ingest key
    const keyHash = await sha256Hex(ingestKey);

    const { data: keyRow, error: keyErr } = await admin
      .from("org_ingest_keys")
      .select("org_id, revoked_at")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (keyErr || !keyRow?.org_id) {
      return json(401, { error: "Invalid ingest key" });
    }

    // 4) Parse request payload
    const payload = await req.json();

    const callId = String(payload.call_id ?? "").trim();
    const phoneRaw = payload.candidate_phone_e164 ?? payload.phone_e164 ?? payload.phone;
    const phone = normalizePhoneE164(phoneRaw);

    if (!callId) return json(400, { error: "call_id is required" });
    if (!phone) return json(400, { error: "candidate_phone_e164 is invalid", details: { phoneRaw } });

    const ai = payload.ai ?? {};

    // 5) Upsert candidate (org_id + phone unique)
    const candidateUpsert: Record<string, unknown> = {
      org_id: keyRow.org_id,
      phone_e164: phone,
      last_called_at: payload.call_time ?? null,
    };

    if (meaningful(ai.name)) candidateUpsert.name = ai.name;
    if (meaningful(ai.roles)) candidateUpsert.roles = ai.roles;
    if (meaningful(ai.experience_summary)) candidateUpsert.experience_summary = ai.experience_summary;
    if (meaningful(ai.driver)) candidateUpsert.driver = ai.driver;
    if (meaningful(ai.dbs_update_service)) candidateUpsert.dbs_update_service = ai.dbs_update_service;
    if (meaningful(ai.mandatory_training)) candidateUpsert.mandatory_training = ai.mandatory_training;

    if (meaningful(ai.earliest_start_date) && ai.earliest_start_date !== "Unknown") {
      candidateUpsert.earliest_start_date = ai.earliest_start_date;
    }

    if (meaningful(ai.weekly_rota_availability)) {
      candidateUpsert.weekly_rota = ai.weekly_rota_availability;
    }

    if (meaningful(ai.tags)) candidateUpsert.tags = ai.tags;

    const { data: candidate, error: candErr } = await admin
      .from("candidates")
      .upsert(candidateUpsert, { onConflict: "org_id,phone_e164" })
      .select("id, energy_count, total_calls_scored")
      .single();

    if (candErr || !candidate) {
      return json(500, { error: "Candidate upsert failed", details: candErr });
    }

    // 6) Insert call row
    const callInsert = {
      org_id: keyRow.org_id,
      call_id: callId,
      candidate_id: candidate.id,
      candidate_phone_e164: phone,
      call_time: payload.call_time ?? null,
      direction: payload.direction ?? null,
      duration_ms: payload.duration_ms ?? null,
      transcript: payload.transcript ?? null,
      recording_url: payload.recording_url ?? null,
      ai_recap: ai.ai_recap ?? null,
      extracted_json: ai.extracted_json ?? ai ?? null,
      energy_score: ai.energy_score ?? null,
    };

    const { error: callErr } = await admin.from("calls").insert(callInsert);

    // Ignore duplicate call insert errors (unique org_id+call_id)
    if (callErr && String((callErr as any).code) !== "23505") {
      return json(500, { error: "Call insert failed", details: callErr });
    }

    // 7) Update energy counters on candidate
    const score = Number(ai.energy_score);
    const hasScore = Number.isFinite(score) && score >= 1 && score <= 5;

    if (hasScore) {
      const total = (candidate.total_calls_scored ?? 0) + 1;
      const count = (candidate.energy_count ?? 0) + (score >= 4 ? 1 : 0);
      const ratio = total > 0 ? count / total : 0;

      await admin
        .from("candidates")
        .update({
          total_calls_scored: total,
          energy_count: count,
          energy_ratio: ratio,
          last_called_at: payload.call_time ?? null,
        })
        .eq("id", candidate.id)
        .eq("org_id", keyRow.org_id);
    }

    return json(200, { ok: true, candidate_id: candidate.id, call_id: callId, phone_e164: phone });
  } catch (e) {
    return json(500, { error: "Unhandled", details: String(e) });
  }
});
