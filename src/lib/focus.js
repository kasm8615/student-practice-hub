// Swing focus practice: one simple focus per ball instead of a swing thought.
// Every shot has three moments: decide (before), sense (during), react and reset (after).
// The golfer rates commitment (did I stay with my focus to the finish?) and result, 1 to 5.
// Saved on a practice-log session as data.focus = { place, shots: [{ kind, card, c, r }] }.

export const FOCUS_KINDS = [
  ["see", "See"], ["hear", "Hear"], ["feel", "Feel"], ["rhythm", "Rhythm"], ["mood", "Mood"]
];
export const KIND_LABEL = Object.fromEntries(FOCUS_KINDS);

// Cards: [kind, text, places it suits]. "all" = range, short game and putting.
export const FOCUS_CARDS = [
  ["see", "Picture where the ball lands before you take the club back", "all"],
  ["see", "Paint a line on the ground where the ball starts", "all"],
  ["see", "Pick the smallest target you can find and keep it in your mind", "all"],
  ["see", "See the curve you want in the air, then let it happen", "range"],
  ["see", "Soft eyes on the back of the ball, target picture in your head", "all"],
  ["see", "Watch the ball roll all the way to the hole in your mind first", "putting"],
  ["hear", "Listen for a crisp, clean strike", "all"],
  ["hear", "Notice how quiet it gets at the top of your swing", "range"],
  ["hear", "Say your target word softly as you swing", "all"],
  ["hear", "Breathe out slowly through the strike and hear it", "all"],
  ["hear", "Hear the ball drop before you look up", "putting"],
  ["feel", "Feel your feet press into the ground through the whole swing", "all"],
  ["feel", "Keep the same grip pressure from start to finish", "all"],
  ["feel", "Hold your finish until the ball stops moving", "all"],
  ["feel", "Loose shoulders at the start and at the finish", "all"],
  ["feel", "Feel your weight arrive on your lead side", "range"],
  ["feel", "Let the club head swing like a pendulum", "short"],
  ["rhythm", "Smooth: three-quarter speed, full finish", "range"],
  ["rhythm", "Count \"one\" going back, \"two\" coming through", "all"],
  ["rhythm", "A tiny pause before you start down", "all"],
  ["rhythm", "Copy the rhythm of your practice swing exactly", "all"],
  ["rhythm", "Hum one long note through the whole swing", "all"],
  ["rhythm", "Same speed back and through", "putting"],
  ["mood", "Calm and patient, like you have all day", "all"],
  ["mood", "Bold: you fully expect this one to be good", "all"],
  ["mood", "Curious: hit it and just see what happens", "all"],
  ["mood", "Grateful to be out here swinging", "all"],
  ["mood", "Playful, like a kid hitting balls for fun", "all"]
];

export const PLACES = [["range", "Range"], ["short", "Short game"], ["putting", "Putting"]];
export const PLACE_AREA = { range: "Full swing", short: "Short game", putting: "Putting" };
export const BALL_COUNTS = [9, 12, 18];

export const CELEBRATE = [
  "Smile and replay that shot once in your head.",
  "Hold your finish and enjoy it for five seconds.",
  "Say one thing you liked about it.",
  "Tell yourself: that's my swing.",
  "Notice how it felt. That's the feeling you're storing."
];
export const RESET = [
  "Say one factual thing about it, then let it go.",
  "Two slow breaths, then pick your next target.",
  "Feel your feet on the ground for five seconds.",
  "Picture the shot you want next, not the one you just hit.",
  "Shrug it off: it's information, not a verdict."
];
export const OKAY = [
  "Good enough counts. Note it and move on.",
  "Most good rounds are built on shots like that one."
];

const pick = (list, seed) => list[Math.abs(seed) % list.length];
export const reactionFor = (r, seed) => (r >= 4 ? ["Celebrate it", pick(CELEBRATE, seed)] : r <= 2 ? ["Reset", pick(RESET, seed)] : ["Move on", pick(OKAY, seed)]);

// Deals the next card: matches the place, rotates through the kinds, never repeats the last few cards.
export function dealCard(place, history = [], rnd = Math.random) {
  const ok = FOCUS_CARDS.filter(([, , p]) => p === "all" || p === place);
  const recent = new Set(history.slice(-6).map(h => h.card));
  const lastKind = history.length ? history[history.length - 1].kind : "";
  let pool = ok.filter(([k, t]) => !recent.has(t) && k !== lastKind);
  if (!pool.length) pool = ok.filter(([, t]) => !recent.has(t));
  if (!pool.length) pool = ok;
  const [kind, card] = pool[Math.floor(rnd() * pool.length)];
  return { kind, card };
}

const avg = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);

// Summary of one session's shots.
export function summarize(shots) {
  const rated = shots.filter(s => s.c && s.r);
  const byKind = FOCUS_KINDS.map(([k, l]) => { const a = rated.filter(s => s.kind === k); return { kind: k, label: l, n: a.length, c: avg(a.map(s => s.c)), r: avg(a.map(s => s.r)) }; }).filter(x => x.n);
  return { n: rated.length, c: avg(rated.map(s => s.c)), r: avg(rated.map(s => s.r)), byKind, committed: rated.filter(s => s.c >= 4).length };
}

// Across all sessions: which focuses give this golfer their best commitment and results.
// A focus needs at least 2 rated balls; score = commitment + result.
export function bestFocuses(sessions, limit = 3) {
  const shots = sessions.flatMap(s => (s.focus && Array.isArray(s.focus.shots) ? s.focus.shots : []).filter(x => x.c && x.r));
  const map = new Map();
  shots.forEach(s => { const m = map.get(s.card) || { kind: s.kind, card: s.card, cs: [], rs: [] }; m.cs.push(s.c); m.rs.push(s.r); map.set(s.card, m); });
  const cards = [...map.values()].filter(m => m.cs.length >= 2).map(m => ({ kind: m.kind, card: m.card, n: m.cs.length, c: avg(m.cs), r: avg(m.rs) }))
    .sort((a, b) => (b.c + b.r) - (a.c + a.r) || b.n - a.n);
  const kinds = FOCUS_KINDS.map(([k, l]) => { const a = shots.filter(s => s.kind === k); return { kind: k, label: l, n: a.length, c: avg(a.map(s => s.c)), r: avg(a.map(s => s.r)) }; })
    .filter(x => x.n >= 3).sort((a, b) => (b.c + b.r) - (a.c + a.r));
  return { total: shots.length, cards: cards.slice(0, limit), kinds };
}
