// Shot dealer: deals one random practice shot at a time, so the student can't pre-plan the next one.
// This is contextual interference (random practice) built into the app. How much changes shot to shot
// depends on level: 0 = serial (set rotation, light variation), 1 = mixed, 2 = random (everything changes).
// Pure functions only (no DOM), so they are easy to test.

export const DEALER_PLACES = [
  ["range", "Driving range"],
  ["short", "Short game"],
  ["putting", "Putting"]
];

export const SCHEDULES = [
  { name: "Serial", line: "Your shots rotate in a set order, so you always know what's next. A good way to build the basics." },
  { name: "Mixed", line: "Club, shot type and target change every shot in no set order. You can't plan the next one." },
  { name: "Random", line: "Everything changes every shot: club, target, shape, lie. You decide and commit each time, like on the course." }
];

// Labels for the three results, by place. Index 0 = best.
export const RESULTS = {
  range: [["On target", "within a green's width"], ["Near", "close, not quite"], ["Missed", "off target"]],
  short: [["Holed / tap-in", "inside 3 ft"], ["Close", "inside 6 ft"], ["Missed", "farther than that"]],
  putting: [["Holed", "in the cup"], ["Close", "finished inside 3 ft"], ["Missed", "left it long or short"]]
};
export const POINTS = [2, 1, 0];

const RANGE_CLUBS = [
  ["7 iron", "9 iron", "Pitching wedge"],
  ["Driver", "Hybrid or fairway wood", "6 iron", "8 iron", "Pitching wedge"],
  ["Driver", "Fairway wood", "Hybrid", "5 iron", "7 iron", "9 iron", "Pitching wedge", "Sand wedge"]
];
const SIDES = ["left side", "center", "right side"];
const SITUATIONS = [
  "Trouble short of the target: don't be short.",
  "Out of bounds left: a miss left costs you a stroke.",
  "Water right: your miss has to be left.",
  "Wind in your face: pick one more club.",
  "Wind helping: take less club.",
  "Pin tucked on the right edge: aim for the middle.",
  "Narrow landing area: pick the club that keeps it in play.",
  "Need to make par: no bogey allowed."
];
const SHAPES = ["straight", "draw", "fade"];
const FLIGHTS = ["normal", "normal", "low", "high"];

const CHIPS = ["Chip", "Pitch", "Bump-and-run"];
const SHORT_LIES = ["Tight lie", "Fluffy lie", "In the rough", "Uphill lie", "Downhill lie", "Ball above your feet", "Ball below your feet"];
const SAND_CLEAN = ["Clean flat lie", "Clean upslope", "Clean downslope"];
const SAND_HARD = ["Fried egg", "Plugged"];

const PUTT_DIST = [[3, 6, 9], [3, 6, 9, 12, 15], [3, 6, 9, 12, 15, 20, 30]];
const PUTT_BREAK = [["Straight"], ["Straight", "Left to right", "Right to left"], ["Straight", "Left to right", "Right to left", "Uphill", "Downhill"]];

const pick = (a, rnd) => a[Math.floor(rnd() * a.length) % a.length];
// Pick something other than the last one used, so the same problem never comes up twice in a row.
const fresh = (a, last, rnd, keyOf = x => x) => { const f = a.filter(x => keyOf(x) !== last); return pick(f.length ? f : a, rnd); };

export const clampLevel = n => Math.max(0, Math.min(2, n));

// bag: the student's carried clubs ([{club, carry}]) if they've filled in their bag, else null.
export function dealShot({ place, level, history = [], bag = null, rnd = Math.random }) {
  const n = history.length, last = history[n - 1]?.shot;
  const L = clampLevel(level);
  if (place === "putting") {
    const dists = PUTT_DIST[L], breaks = PUTT_BREAK[L];
    const key = s => s.ft + "|" + s.brk;
    let ft, brk;
    if (L === 0) { ft = dists[n % dists.length]; brk = breaks[0]; }
    else {
      const all = dists.flatMap(d => breaks.map(b => ({ ft: d, brk: b })));
      ({ ft, brk } = fresh(all, last && key(last), rnd, key));
    }
    return { place, level: L, ft, brk, band: ft + " ft", title: `${ft} ft`, lines: [brk === "Straight" ? "Straight putt" : brk], routine: true };
  }
  if (place === "short") {
    let type, lie, steps;
    if (L === 0) { type = CHIPS[n % CHIPS.length]; lie = "Good lie"; steps = 5 + Math.floor(rnd() * 11); }
    else {
      const types = L === 1 ? [...CHIPS, "Bunker shot"] : [...CHIPS, "High soft shot", "Bunker shot", "Bunker shot"];
      type = fresh(types, last?.type, rnd);
      const sand = type === "Bunker shot";
      lie = sand ? pick(L === 1 ? SAND_CLEAN : [...SAND_CLEAN, ...SAND_HARD], rnd) : pick(L === 1 ? SHORT_LIES.slice(0, 3) : SHORT_LIES, rnd);
      steps = sand ? pick([6, 9, 12, 18], rnd) : (L === 1 ? 5 + Math.floor(rnd() * 16) : 4 + Math.floor(rnd() * 27));
    }
    const sand = type === "Bunker shot";
    return { place, level: L, type, lie, steps, band: type, title: type, lines: [lie, sand ? `Flag about ${steps} yards away` : `${steps} steps to the flag`], routine: true };
  }
  // range
  const carries = bag && bag.length >= 3 ? bag.map(c => ({ club: c.club, carry: c.carry })) : null;
  const clubs = carries ? carries.map(c => c.club) : RANGE_CLUBS[L];
  const club = L === 0 ? clubs[n % clubs.length] : fresh(clubs, last?.club, rnd);
  const carry = carries?.find(c => c.club === club)?.carry;
  const lines = [carry ? `Pick a target about ${carry} yards` : "Pick a target about as far as this club carries"];
  let side = null, shape = null, flight = null, situation = null;
  if (L >= 1) { side = pick(SIDES, rnd); lines.push(`Aim for the ${side} of your target area`); }
  if (L === 2) {
    shape = pick(SHAPES, rnd); flight = pick(FLIGHTS, rnd);
    const bits = [shape === "straight" ? "" : shape, flight === "normal" ? "" : flight].filter(Boolean);
    lines.push(bits.length ? `Call it: ${bits.join(", ")} ball flight` : "Call it: normal, straight ball flight");
    situation = pick(SITUATIONS, rnd); lines.push(situation);
  }
  return { place, level: L, club, carry: carry || null, side, shape, flight, situation, band: club, title: club, lines, routine: true };
}

// Stats for a session: overall and by band (club / shot type / distance), best first by volume.
export function summarize(history) {
  const done = history.filter(h => h.res != null);
  const total = done.length;
  const pts = done.reduce((a, h) => a + POINTS[h.res], 0);
  const best = done.filter(h => h.res === 0).length;
  const bands = {};
  done.forEach(h => { const b = (bands[h.shot.band] ||= { band: h.shot.band, n: 0, best: 0, close: 0, sortKey: h.shot.ft ?? 0 }); b.n++; if (h.res === 0) b.best++; if (h.res <= 1) b.close++; });
  const list = Object.values(bands).sort((a, b) => a.sortKey - b.sortKey || b.n - a.n);
  let streak = 0, bestStreak = 0;
  done.forEach(h => { streak = h.res === 0 ? streak + 1 : 0; bestStreak = Math.max(bestStreak, streak); });
  return { total, best, pts, max: total * 2, bands: list, streak, bestStreak, pct: total ? Math.round(best / total * 100) : 0 };
}

// One line per band for the practice log, e.g. "6 ft: 3 of 5".
export function bandLines(sum, place) {
  const word = place === "putting" ? "holed" : place === "short" ? "holed or tap-in" : "on target";
  return sum.bands.map(b => `${b.band}: ${b.best} of ${b.n} ${word}`);
}
