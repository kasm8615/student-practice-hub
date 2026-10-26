// Skill games: practice for the person hitting the shot, not only the swing.
// Each game is saved on a practice-log session as data.skill = { id, lines: [summary lines], ...game data }.
// All wording here is original.

export const SKILL_GAMES = [
  { id: "speed", name: "Speed dial", area: "Full swing", mins: 20,
    why: "One club at four speeds. Learn the carry of each and you have more shots without buying a club." },
  { id: "ladder", name: "Trust ladder", area: "Mental", mins: 20,
    why: "Climb a ladder of fully committed shots in a row. Lose your commitment and that rung starts over." },
  { id: "fewest", name: "Fewest balls", area: "Short game", mins: 45,
    why: "Tick off a list of good shots across your whole game in as few balls as you can. Built around your weakest stat." },
  { id: "energy", name: "Energy switch", area: "Mental", mins: 20,
    why: "Hit shots calm, steady and fired up. Find the energy you play your best golf with." },
  { id: "react", name: "Reaction reset", area: "Mental", mins: 15,
    why: "Practice the seconds after the shot: lock in the good ones, let go of the poor ones." },
  { id: "decide", name: "Decide and go", area: "Mental", mins: 15,
    why: "Pick the club on gut feel, say it out loud and hit within 10 seconds. Train your trust." }
];
export const gameById = id => SKILL_GAMES.find(g => g.id === id);
export const PLACES3 = [["range", "Range"], ["short", "Short game"], ["putting", "Putting"]];
const AREA_OF = { range: "Full swing", short: "Short game", putting: "Putting" };
export const areaOfPlace = p => AREA_OF[p] || "Full swing";

const shuffle = (a, rnd = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const avg = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
export const f1 = v => (v == null ? "–" : (Math.round(v * 10) / 10).toFixed(1));
// Random order with every item the same number of times and no item twice in a row.
export function spread(items, each, rnd = Math.random) {
  for (let t = 0; t < 30; t++) {
    const a = shuffle(items.flatMap(x => Array(each).fill(x)), rnd);
    if (a.every((x, i) => i === 0 || x !== a[i - 1])) return a;
  }
  return items.flatMap(x => Array(each).fill(x));
}

// ---------- Speed dial
export const SPEEDS = [25, 50, 75, 100];
export const SPEED_HELP = {
  25: "Slow motion. Full length, full finish.",
  50: "Half speed. Smooth and easy.",
  75: "Your comfortable, in-control speed.",
  100: "As fast as you can and still hold your finish."
};
// First round climbs 25 → 100 so you feel the scale; rounds 2 and 3 are mixed up.
export const speedOrder = (rnd = Math.random) => [...SPEEDS, ...shuffle(SPEEDS, rnd), ...shuffle(SPEEDS, rnd)];
export function speedSummary(shots) {
  return SPEEDS.map(sp => {
    const a = shots.filter(s => s.speed === sp), c = a.filter(s => +s.carry > 0).map(s => +s.carry);
    return { speed: sp, n: a.length, carry: c.length ? Math.round(avg(c)) : null, balanced: a.filter(s => s.balance).length };
  });
}

// ---------- Trust ladder
export const LADDERS = [[3, 4, 5], [3, 5, 7], [5, 7, 10]]; // by level: building, developing, competitive

// ---------- Fewest balls
// need = good shots needed. Distances shrink for newer golfers.
export function fewestTasks(level, focusKey, scope = "all") {
  const L = level;
  const putt = [
    { id: "p-short", area: "Putting", label: `Hole ${L === 0 ? "3 putts from 3 ft" : "3 putts from 5 ft"}`, need: 3 },
    { id: "p-lag", area: "Putting", label: `Lag 2 putts from ${L === 2 ? 40 : 30} ft to inside a putter length`, need: 2 },
    { id: "p-long", area: "Putting", label: `Lag 1 putt from ${L === 2 ? 60 : 45} ft to inside a putter length`, need: 1 }
  ];
  const short = [
    { id: "c-low", area: "Short game", label: "2 low chips that land on your spot and release", need: 2 },
    { id: "c-high", area: "Short game", label: "2 higher chips that stop within 6 ft", need: 2 },
    { id: "pitch", area: "Short game", label: `2 pitches of ${L === 0 ? 20 : 35} yards that finish on the green`, need: 2 },
    { id: "sand", area: "Short game", label: "2 bunker shots out and on the green", need: 2, skippable: true }
  ];
  const full = [
    { id: "f-wedge", area: "Full swing", label: "1 full wedge inside your target circle", need: 1 },
    { id: "f-short", area: "Full swing", label: "1 short iron (8 or 9) at your target", need: 1 },
    { id: "f-mid", area: "Full swing", label: "1 mid iron or hybrid at your target", need: 1 },
    { id: "f-wood", area: "Full swing", label: "1 fairway wood or hybrid that would find the fairway", need: 1 },
    { id: "f-drive", area: "Full swing", label: "2 drives that would find the fairway", need: 2 }
  ];
  // Extra work on the weakest part of their game.
  const extra = {
    putts: { id: "x-putt", area: "Putting", label: "Bonus: hole 2 in a row from 6 ft", need: 2 },
    updown: { id: "x-ud", area: "Short game", label: "Bonus: 2 chips that finish inside 3 ft", need: 2 },
    gir: { id: "x-gir", area: "Full swing", label: "Bonus: 2 approach shots that would hit the green", need: 2 },
    fairways: { id: "x-fw", area: "Full swing", label: "Bonus: 2 more drives that would find the fairway", need: 2 }
  }[focusKey];
  const pool = scope === "short" ? [...putt, ...short] : scope === "range" ? full : [...putt, ...short, ...full];
  if (extra && pool.some(t => t.area === extra.area)) pool.push(extra);
  return pool;
}
export const fewestPar = (tasks, level) => Math.round(tasks.reduce((a, t) => a + t.need, 0) * [2.2, 1.8, 1.5][level]);

// ---------- Energy switch
export const ENERGY = [
  { id: "calm", name: "Calm", how: "Three long, slow breaths out. Let your shoulders drop and your hands go soft." },
  { id: "steady", name: "Steady", how: "Walk briskly to the ball and back once. Normal breathing, alert eyes." },
  { id: "fired", name: "Fired up", how: "Ten quick jumping jacks or fast feet on the spot. Feel your heart rate rise." }
];
export function byState(shots, key, list) {
  return list.map(x => { const a = shots.filter(s => s[key] === x.id && s.c && s.r); return { ...x, n: a.length, c: avg(a.map(s => s.c)), r: avg(a.map(s => s.r)) }; }).filter(x => x.n);
}

// ---------- Reaction reset
export const AFTER_GOOD = [
  { id: "hold", name: "Hold the finish", how: "Stay in your finish until the ball lands. Enjoy it." },
  { id: "replay", name: "Replay it", how: "Close your eyes and run that shot once more in your head." },
  { id: "say", name: "Name what you liked", how: "Say one thing you liked about it, out loud or to yourself." },
  { id: "tall", name: "Walk off tall", how: "Chin up, shoulders back, walk away slowly like it was routine." },
  { id: "breathe", name: "Breathe it in", how: "Smile and take one slow breath while the feeling sinks in." }
];
export const AFTER_POOR = [
  { id: "exhale", name: "Two slow exhales", how: "Breathe out slowly twice. Let your shoulders drop." },
  { id: "fact", name: "One fact only", how: "Say one plain fact, like \"pulled it, ten yards left\", and stop there." },
  { id: "far", name: "Look far away", how: "Look at a tree or the horizon for five seconds." },
  { id: "next", name: "See the next one", how: "Picture the next shot you want, not the one you just hit." },
  { id: "tap", name: "Tap it closed", how: "Tap the club on your shoe once: that shot is done." }
];
export function reactionFavorites(shots) {
  const rank = (list, kind) => list.map(x => { const a = shots.filter(s => s.kind === kind && s.routine === x.id && s.feel); return { ...x, n: a.length, feel: avg(a.map(s => s.feel)) }; })
    .filter(x => x.n).sort((a, b) => b.feel - a.feel || b.n - a.n);
  return { good: rank(AFTER_GOOD, "good"), poor: rank(AFTER_POOR, "poor") };
}

// ---------- Decide and go
const SHORT_SHOTS = [
  "15-yard chip to a tight pin", "25-yard pitch over a bunker", "Chip from the fringe, 40 ft of green to work with",
  "40-yard pitch to the middle of the green", "Chip from thick rough to a back pin", "Bunker shot, pin 10 yards away",
  "30-yard pitch into a breeze", "Chip down a slope to a front pin", "Pitch from a tight lie, 20 yards"
];
const TWISTS = ["", "", "into a breeze", "downwind", "ball slightly above your feet", "ball slightly below your feet", "water short of the green", "pin tucked left", "pin tucked right"];
export function decideShot(place, carries, rnd = Math.random) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  if (place === "putting") {
    const ft = [4, 6, 8, 12, 15, 20, 25, 30, 40][Math.floor(rnd() * 9)];
    return `${ft}-foot putt, ${pick(["straight", "breaking left", "breaking right", "uphill", "downhill"])}`;
  }
  if (place === "short") return pick(SHORT_SHOTS);
  const c = carries.filter(x => x > 0);
  const lo = c.length ? Math.min(...c) : 70, hi = c.length ? Math.max(...c) : 170;
  const yds = Math.round((lo + rnd() * Math.max(10, Math.min(hi, lo + 110) - lo)) / 5) * 5;
  const tw = pick(TWISTS);
  return `${yds} yards${tw ? ", " + tw : ""}`;
}
export const DECIDE_SECONDS = 10;

// Shared: averages of commitment and result.
export function cr(shots) {
  const a = shots.filter(s => s.c && s.r);
  return { n: a.length, c: avg(a.map(s => s.c)), r: avg(a.map(s => s.r)) };
}
