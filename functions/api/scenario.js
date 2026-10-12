// Cloudflare Pages Function: /api/scenario
// GET  -> { ai: true|false } whether AI tailoring is switched on
// POST -> tailors a practice session (games chosen in the app from the library) to one student, using Claude.
// POST {kind:"review"} -> reviews one logged round and recommends one library game.
//
// Cloudflare variables (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  (secret) – from console.anthropic.com. Leave unset to turn the feature off.
//   Optional: ANTHROPIC_MODEL (defaults to claude-haiku-4-5, fast and about half a cent per request)
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (already set for the app)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function signedIn(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const url = String(env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.VITE_SUPABASE_ANON_KEY || "").trim();
  const res = await fetch(`${url}/rest/v1/rpc/whoami`, {
    method: "POST", headers: { apikey: key, authorization: auth, "content-type": "application/json" }, body: "{}"
  });
  if (!res.ok) return false;
  const who = await res.json();
  return !!who && (who.role === "coach" || who.role === "student");
}

const clip = (v, n) => String(v ?? "").slice(0, n);

const SYSTEM = `You are the practice assistant inside Karina Sánchez's golf coaching app. Karina is a TPI-certified golf coach.
A student has picked a practice session made of games from Karina's library. Tailor it to this student using their stats, goals, drills and recent practice notes.
Rules:
- Keep each game as it is. Only add a short personal tip and, if useful, adjust the target to fit the student (a little challenging, achievable).
- Be specific and practical. Plain words a 12-year-old or an adult beginner understands. No swing-mechanics overhauls; leave technique to Karina.
- Never mention injuries, medical advice or equipment purchases.
- intro: 1–2 sentences on why this session fits them, referencing their numbers or goals when available.
- tip: max 25 words. target: same format as the given target (e.g. "8 / 18", "under 20 balls").
Reply with JSON only, no other text: {"intro": "...", "games": [{"id": "...", "tip": "...", "target": "..."}]}`;

const REVIEW_SYSTEM = `You are the round-review assistant inside Karina Sánchez's golf coaching app. Karina is a TPI-certified golf coach.
A student just logged a round. Review it like a supportive, honest coach: use their numbers, their own notes, their previous rounds and the benchmark (average stats of amateur golfers who shoot their target score).
Rules:
- Plain words a 12-year-old or an adult beginner understands. Encouraging but honest. No swing-mechanics advice; leave technique to Karina.
- Only use facts in the data. If a stat is missing, don't guess it; you can suggest tracking it next time.
- Never mention injuries, medical advice or equipment purchases.
- headline: one sentence summing up the round.
- good: 1–2 short bullets. cost: 1–3 short bullets on where strokes were lost, with numbers when available (e.g. "3 three-putts ≈ 3 strokes").
- focus: one sentence, the single most important thing to practice this week.
- game_id: the id of ONE game from the provided library that best trains the focus.
- mental: one short sentence on mindset, based on their notes (or omit with "").
Reply with JSON only: {"headline":"...","good":["..."],"cost":["..."],"focus":"...","game_id":"...","mental":"..."}`;

async function claude(env, system, user, max = 700) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.ANTHROPIC_MODEL || "claude-haiku-4-5", max_tokens: max, system, messages: [{ role: "user", content: user }] })
  });
  if (!res.ok) return null;
  const out = await res.json();
  const text = (out.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  try { return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch { return null; }
}

async function review(p, env) {
  const r = p.round || {};
  const keep = ["date", "event", "course", "holes", "score", "putts", "fairways", "gir", "updown", "penalties", "threeputts", "doubles", "notes"];
  const round = Object.fromEntries(keep.map(k => [k, clip(r[k], k === "notes" ? 600 : 40)]).filter(([, v]) => v !== ""));
  if (!round.score) return json({ error: "This round has no score to review." }, 400);
  const games = (Array.isArray(p.games) ? p.games : []).slice(0, 60).map(g => ({ id: clip(g.id, 40), name: clip(g.name, 80), place: clip(g.place, 20), helps: (g.helps || []).slice(0, 5).map(h => clip(h, 20)) }));
  const pl = p.player || {};
  const user = JSON.stringify({
    round, previous_rounds: (p.previous || []).slice(0, 5), target_score: +p.target || null, benchmark_for_target: p.benchmark || null,
    player: { handicap: clip(pl.handicap, 10), group: clip(pl.group, 10), goals: Object.fromEntries(Object.entries(pl.goals || {}).slice(0, 4).map(([k, v]) => [clip(k, 10), clip(v, 200)])), current_drills: (pl.drills || []).slice(0, 6).map(d => clip(d, 60)) },
    game_library: games
  });
  const out = await claude(env, REVIEW_SYSTEM, user, 800);
  if (!out) return json({ error: "Couldn't review right now. Try again." }, 502);
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n).map(x => clip(x, 200)).filter(Boolean);
  return json({
    headline: clip(out.headline, 200), good: list(out.good, 2), cost: list(out.cost, 3), focus: clip(out.focus, 240),
    game_id: games.some(g => g.id === out.game_id) ? out.game_id : "", mental: clip(out.mental, 200), at: new Date().toISOString()
  });
}

export async function onRequestGet({ env }) {
  return json({ ai: !!env.ANTHROPIC_API_KEY });
}

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: "AI tailoring isn't switched on." }, 503);
  if (!(await signedIn(request, env))) return json({ error: "Please sign in again." }, 401);

  let p;
  try { p = await request.json(); } catch { return json({ error: "Bad request." }, 400); }
  if (p.kind === "review") return review(p, env);
  const games = (Array.isArray(p.games) ? p.games : []).slice(0, 4).map(g => ({
    id: clip(g.id, 40), name: clip(g.name, 80), setup: clip(g.setup, 300), score: clip(g.score, 160), target: clip(g.target, 40)
  }));
  if (!games.length) return json({ error: "No games to tailor." }, 400);
  const pl = p.player || {};
  const player = {
    handicap: clip(pl.handicap, 10), group: clip(pl.group, 10),
    goals: Object.fromEntries(Object.entries(pl.goals || {}).slice(0, 4).map(([k, v]) => [clip(k, 10), clip(v, 200)])),
    averages_last_rounds: pl.averages || null,
    current_drills: (pl.drills || []).slice(0, 6).map(d => clip(d, 60)),
    recent_practice_notes: (pl.recent || []).slice(0, 3).map(r => clip(r, 300))
  };
  const user = JSON.stringify({ place: clip(p.place, 20), minutes: +p.minutes || 0, focus: clip(p.focus, 20), games, player });

  const parsed = await claude(env, SYSTEM, user);
  if (!parsed) return json({ error: "Couldn't tailor right now. The games still work as they are." }, 502);
  const ids = new Set(games.map(g => g.id));
  return json({
    intro: clip(parsed.intro, 400),
    games: (parsed.games || []).filter(g => ids.has(g.id)).map(g => ({ id: g.id, tip: clip(g.tip, 220), target: clip(g.target, 40) }))
  });
}
