// Cloudflare Pages Function: /api/scenario
// GET  -> { ai: true|false } whether AI tailoring is switched on
// POST -> tailors a practice session (games chosen in the app from the library) to one student, using Claude.
// POST {kind:"review"} -> reviews one logged round and recommends one library game.
// POST {kind:"bag-photo", image} -> reads club distances from a photo (launch monitor report, yardage card, handwritten list).
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
- Fit the advice to the student's week: "tournament" = practice like you play (routine, scoring, pressure, course strategy; nothing big to fix; if days_to_tournament ≤ 2, keep it light and confidence-building). "swing" = swing change: slow, deliberate reps, one feel, film it, results don't matter yet; never suggest a different swing change than Karina's. "fun" = playing with friends: keep it light and competitive. "normal" = regular improvement.
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
- If hole-by-hole data and patterns are provided, use them: name the miss pattern off the tee (left/right, and whether misses started on target and curved, or started off target and stayed there), approach misses by direction, club and distance, landing-spot accuracy on chips, bunker results, first-putt distances and 3-putts, and where penalties came from. Describe the pattern; leave the swing fix to Karina (e.g. "Bring this pattern to your next lesson").
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
    round, patterns: p.patterns || null, holes: Array.isArray(p.holes) ? p.holes.slice(0, 18) : null, previous_rounds: (Array.isArray(p.previous) ? p.previous : []).slice(0, 5), target_score: +p.target || null, benchmark_for_target: p.benchmark || null,
    player: { handicap: clip(pl.handicap, 10), group: clip(pl.group, 10), goals: Object.fromEntries(Object.entries(pl.goals || {}).slice(0, 4).map(([k, v]) => [clip(k, 10), clip(v, 200)])), current_drills: (Array.isArray(pl.drills) ? pl.drills : []).slice(0, 6).map(d => clip(d, 60)), club_carries: (Array.isArray(pl.club_carries) ? pl.club_carries : []).slice(0, 40).map(c => clip(c, 30)) },
    game_library: games
  });
  if (user.length > 20000) return json({ error: "This round has too much data to review." }, 400);
  const out = await claude(env, REVIEW_SYSTEM, user, 900);
  if (!out) return json({ error: "Couldn't review right now. Try again." }, 502);
  const list = (a, n) => (Array.isArray(a) ? a : []).slice(0, n).map(x => clip(x, 200)).filter(Boolean);
  return json({
    headline: clip(out.headline, 200), good: list(out.good, 2), cost: list(out.cost, 3), focus: clip(out.focus, 240),
    game_id: games.some(g => g.id === out.game_id) ? out.game_id : "", mental: clip(out.mental, 200), at: new Date().toISOString()
  });
}

const BAG_SYSTEM = `You read golf club distances from a photo: a launch monitor report, a yardage card, an app screenshot or a handwritten list.
Return every club you can read with its CARRY and TOTAL distance in yards. If the photo shows meters, convert to yards (× 1.094). If there are several shots per club, use the average. If only one distance is shown per club, treat it as carry.
Use these club names when they fit: Driver, 3 wood, 5 wood, 7 wood, 3 hybrid, 4 hybrid, 5 hybrid, 4 iron, 5 iron, 6 iron, 7 iron, 8 iron, 9 iron, PW, GW, SW, LW. Wedges given by loft: 46–48° = PW, 50–52° = GW, 54–56° = SW, 58–60° = LW. Skip the putter.
Only include numbers you can actually read. If the photo has no club distances, return an empty list.
Reply with JSON only: {"clubs":[{"club":"7 iron","carry":150,"total":158}]}`;

async function bagPhoto(p, env) {
  const img = String(p.image || "");
  if (!img || img.length > 4_000_000 || !/^[A-Za-z0-9+/=]+$/.test(img.slice(0, 200))) return json({ error: "That photo is too big or not readable. Try a screenshot." }, 400);
  const out = await claude(env, BAG_SYSTEM, [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } },
    { type: "text", text: "Read the club distances from this photo." }
  ], 800);
  if (!out) return json({ error: "Couldn't read that photo. Try a clearer one." }, 502);
  const num = v => { const n = Math.round(+v); return n > 0 && n < 450 ? n : ""; };
  const clubs = (Array.isArray(out.clubs) ? out.clubs : []).slice(0, 20).map(c => ({ club: clip(c.club, 30), carry: num(c.carry), total: num(c.total) })).filter(c => c.club && (c.carry || c.total));
  return json({ clubs });
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
  if (p.kind === "bag-photo") return bagPhoto(p, env);
  const games = (Array.isArray(p.games) ? p.games : []).slice(0, 4).map(g => ({
    id: clip(g.id, 40), name: clip(g.name, 80), setup: clip(g.setup, 300), score: clip(g.score, 160), target: clip(g.target, 40)
  }));
  if (!games.length) return json({ error: "No games to tailor." }, 400);
  const pl = p.player || {};
  const player = {
    handicap: clip(pl.handicap, 10), group: clip(pl.group, 10),
    goals: Object.fromEntries(Object.entries(pl.goals || {}).slice(0, 4).map(([k, v]) => [clip(k, 10), clip(v, 200)])),
    averages_last_rounds: pl.averages && typeof pl.averages === "object" ? Object.fromEntries(Object.entries(pl.averages).slice(0, 8).filter(([, v]) => v == null || Number.isFinite(+v)).map(([k, v]) => [clip(k, 20), v == null ? null : Math.round(+v * 10) / 10])) : null,
    club_carries: (Array.isArray(pl.club_carries) ? pl.club_carries : []).slice(0, 40).map(c => clip(c, 30)),
    current_drills: (Array.isArray(pl.drills) ? pl.drills : []).slice(0, 6).map(d => clip(d, 60)),
    recent_practice_notes: (Array.isArray(pl.recent) ? pl.recent : []).slice(0, 3).map(r => clip(r, 300))
  };
  const user = JSON.stringify({ place: clip(p.place, 20), minutes: +p.minutes || 0, focus: clip(p.focus, 20), week: clip(p.week || "normal", 12), days_to_tournament: Number.isFinite(+p.days_to_tournament) && p.days_to_tournament !== null ? Math.round(+p.days_to_tournament) : null, games, player });
  if (user.length > 20000) return json({ error: "Too much data to tailor." }, 400);

  const parsed = await claude(env, SYSTEM, user);
  if (!parsed) return json({ error: "Couldn't tailor right now. The games still work as they are." }, 502);
  const ids = new Set(games.map(g => g.id));
  return json({
    intro: clip(parsed.intro, 400),
    games: (parsed.games || []).filter(g => ids.has(g.id)).map(g => ({ id: g.id, tip: clip(g.tip, 220), target: clip(g.target, 40) }))
  });
}
