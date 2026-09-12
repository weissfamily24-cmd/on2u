// Edge Function verify-qr — ON2U Eats
// Vertrag: docs/schema-contract.md, Abschnitt "Edge Function verify-qr".
//
// POST /functions/v1/verify-qr, Header "Authorization: Bearer <user jwt>",
// Body { "token": "..." }.
// 200 → { visit_id, place_id, place_name, table_label }
// 401 → "Bitte melde dich an, um zu bewerten."
// 404 → "Code nicht erkannt. Näher ran oder das Licht am Tisch anmachen."
// 429 → "Du hast hier gerade schon eingecheckt." (+ visit_id des bestehenden Besuchs)
//
// verify_jwt ist in config.toml aus, damit wir den 401 selbst mit deutschem
// Text beantworten können. Das JWT prüfen wir hier über auth.getUser().

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Gleicher Nutzer, gleiches Lokal innerhalb dieses Fensters → 429
const RECHECKIN_WINDOW_MS = 30 * 60 * 1000;

const TEXT = {
  unauthorized: "Bitte melde dich an, um zu bewerten.",
  notFound: "Code nicht erkannt. Näher ran oder das Licht am Tisch anmachen.",
  alreadyCheckedIn: "Du hast hier gerade schon eingecheckt.",
  methodNotAllowed: "Nur POST erlaubt.",
  serverError: "Da ist etwas schiefgelaufen. Bitte noch einmal versuchen.",
} as const;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type TokenRow = {
  id: string;
  place_id: string;
  table_label: string | null;
  active: boolean;
  // supabase-js typisiert die Relation je nach Version als Objekt oder Array
  places: { name: string } | { name: string }[] | null;
};

function placeName(rel: TokenRow["places"]): string {
  if (!rel) return "";
  if (Array.isArray(rel)) return rel[0]?.name ?? "";
  return rel.name ?? "";
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight für Browser-Aufrufe
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: TEXT.methodNotAllowed }, 405);
  }

  // 1) Nutzer aus dem JWT im Authorization-Header
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: TEXT.unauthorized }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // JWT explizit übergeben: der Client hat keine Session, getUser() ohne
  // Argument würde "Auth session missing" liefern.
  const jwt = authHeader.slice("bearer ".length).trim();
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(jwt);

  if (userError || !user) {
    return json({ error: TEXT.unauthorized }, 401);
  }

  // 2) Token aus dem Body
  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    token = "";
  }
  if (!token) {
    return json({ error: TEXT.notFound }, 404);
  }

  // 3) Token nachschlagen (Service Role: qr_tokens sind für Gäste nicht lesbar)
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tokenRow, error: tokenError } = await admin
    .from("qr_tokens")
    .select("id, place_id, table_label, active, places ( name )")
    .eq("token", token)
    .maybeSingle<TokenRow>();

  if (tokenError) {
    console.error("verify-qr: token lookup failed", tokenError);
    return json({ error: TEXT.serverError }, 500);
  }
  if (!tokenRow || !tokenRow.active) {
    return json({ error: TEXT.notFound }, 404);
  }

  const name = placeName(tokenRow.places);

  // 4) Schon eingecheckt? (gleicher Nutzer, gleiches Lokal, < 30 Minuten)
  const since = new Date(Date.now() - RECHECKIN_WINDOW_MS).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("visits")
    .select("id")
    .eq("user_id", user.id)
    .eq("place_id", tokenRow.place_id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (recentError) {
    console.error("verify-qr: recent visit lookup failed", recentError);
    return json({ error: TEXT.serverError }, 500);
  }
  if (recent) {
    return json(
      {
        error: TEXT.alreadyCheckedIn,
        visit_id: recent.id,
        place_id: tokenRow.place_id,
        place_name: name,
        table_label: tokenRow.table_label,
      },
      429,
    );
  }

  // 5) Besuch anlegen
  const { data: visit, error: visitError } = await admin
    .from("visits")
    .insert({
      place_id: tokenRow.place_id,
      user_id: user.id,
      qr_token: token,
      table_label: tokenRow.table_label,
    })
    .select("id")
    .single<{ id: string }>();

  if (visitError || !visit) {
    console.error("verify-qr: visit insert failed", visitError);
    return json({ error: TEXT.serverError }, 500);
  }

  return json({
    visit_id: visit.id,
    place_id: tokenRow.place_id,
    place_name: name,
    table_label: tokenRow.table_label,
  });
});
