// Fuel <-> Claude health artifact sync store
// Deploy on Cloudflare Workers + one KV namespace bound as STATE
// Secret: SYNC_TOKEN

const ALLOW_ORIGINS = [
  "https://brandondahl-dot.github.io",
  "https://claude.ai",
  "https://claudeusercontent.com",
];

function cors(req) {
  const origin = req.headers.get("Origin") || "";
  const allow =
    ALLOW_ORIGINS.includes(origin) ||
    origin.endsWith(".github.io") ||
    origin.endsWith(".claudeusercontent.com") ||
    origin.endsWith(".anthropic.com")
      ? origin
      : ALLOW_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(req) },
  });
}

function authorized(req, env) {
  const header = req.headers.get("Authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token && env.SYNC_TOKEN && token === env.SYNC_TOKEN;
}

function merge(local = {}, remote = {}) {
  const out = {
    version: remote.version || local.version || "1.16",
    updatedAt: new Date().toISOString(),
    settings: { ...(local.settings || {}) },
    days: { ...(local.days || {}) },
  };
  const rs = remote.settings || {};
  const ls = local.settings || {};
  if ((rs.settingsUpdatedAt || "") >= (ls.settingsUpdatedAt || "")) {
    out.settings = {
      protein: rs.protein ?? ls.protein,
      calories: rs.calories ?? ls.calories,
      carbs: rs.carbs ?? ls.carbs,
      fat: rs.fat ?? ls.fat,
      savedMeals: rs.savedMeals || ls.savedMeals || [],
      settingsUpdatedAt: rs.settingsUpdatedAt || ls.settingsUpdatedAt || "",
      coachNote: rs.coachNote != null ? rs.coachNote : ls.coachNote || "",
    };
  } else if (rs.coachNote != null) {
    out.settings.coachNote = rs.coachNote;
  }
  const dates = new Set([
    ...Object.keys(local.days || {}),
    ...Object.keys(remote.days || {}),
  ]);
  for (const date of dates) {
    const a = (local.days || {})[date];
    const b = (remote.days || {})[date];
    if (!a) out.days[date] = b;
    else if (!b) out.days[date] = a;
    else out.days[date] = (b.updatedAt || "") >= (a.updatedAt || "") ? b : a;
  }
  return out;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(req) });
    }
    if (url.pathname === "/health") return json(req, { ok: true });
    if (url.pathname !== "/v1/state") return json(req, { error: "not found" }, 404);
    if (!authorized(req, env)) return json(req, { error: "unauthorized" }, 401);
    if (req.method === "GET") {
      const raw = await env.STATE.get("fuel");
      if (!raw) return json(req, { error: "missing" }, 404);
      return new Response(raw, {
        status: 200,
        headers: { "Content-Type": "application/json", ...cors(req) },
      });
    }
    if (req.method === "PUT") {
      let incoming;
      try { incoming = await req.json(); }
      catch { return json(req, { error: "invalid json" }, 400); }
      const raw = await env.STATE.get("fuel");
      const current = raw ? JSON.parse(raw) : {};
      const next = merge(current, incoming);
      await env.STATE.put("fuel", JSON.stringify(next));
      return json(req, next);
    }
    return json(req, { error: "method" }, 405);
  },
};
