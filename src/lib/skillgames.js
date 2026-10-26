// Skill games: practice for the person hitting the shot, not only the swing.
// Each game is saved on a practice-log session as data.skill = { id, lines: [summary lines], ...game data }.
// All wording here is original.

export const SKILL_GAMES = [
  { id: "speed", name: "Speed dial", area: "Full swing", mins: 20,
    why: "One club at four speeds. Learn the carry of each and you have more shots without buying a club." },
  { id: "trust", name: "Trust test", area: "On course", mins: 20,
    why: "Real course situations: go at the pin or play it safe? Pick the shot and the club you trust, then see when you commit best." },
  { id: "maker", name: "Shotmaker challenge", area: "Full swing", mins: 30,
    why: "Six real shots to pull off: a 20-yard fade, a dead-straight 8 iron, bunker shots from bad lies. Pick your area and difficulty." },
  { id: "energy", name: "Energy switch", area: "Mental", mins: 20,
    why: "Hit shots calm, steady and fired up. Find the energy you play your best golf with." },
  { id: "react", name: "Reaction reset", area: "Mental", mins: 15,
    why: "Practice the seconds after the shot: lock in the good ones, let go of the poor ones." },
  { id: "decide", name: "Decide and go", area: "Mental", mins: 15,
    why: "On the course, doubt costs more shots than a bad swing. Decide fast, say it, hit it. Train a clear mind over the ball." }
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

// ---------- Trust test: course situations, go at it or play safe
// [area, situation, aggressive option, safe option]
export const TRUST = [
  ["range", "140 yards. Bunker short right, pin tucked just behind it. The middle of the green leaves a 25-foot putt.", "Go at the pin", "Middle of the green"],
  ["range", "Par 5, 210 yards to the green, all carry over water. Laying up leaves your favorite wedge.", "Go for the green", "Lay up to your wedge number"],
  ["range", "Tee shot. The fairway pinches with a bunker right where your driver lands. A 3 wood or hybrid stays short, where it's wide.", "Driver", "3 wood or hybrid to the wide part"],
  ["range", "165 yards. Out of bounds left and the pin is on the left. The right half of the green is safe.", "At the flag", "Right half of the green"],
  ["range", "100 yards to a pin on the front edge, just over a false front. Long leaves a downhill putt.", "Flag it", "Back middle, putt down"],
  ["range", "150 yards from the rough with a flyer lie, water short of a front pin.", "At the pin", "Middle of the green, well past the water"],
  ["range", "160 yards to the green through a gap in the trees about two club-heads wide.", "Through the gap", "Chip back to the fairway"],
  ["range", "135 yards into a strong wind, pin at the back.", "Your normal club at the flag", "One more club, smooth swing to the middle"],
  ["short", "Short-sided in the rough. The pin is 15 feet onto a green running away from you.", "Flop it close", "Bump it to the fat part, 15 to 20 feet"],
  ["short", "Greenside bunker with a high lip. Pin 10 feet from the edge.", "Attack the pin", "Just get it on, center of the green"],
  ["short", "40-yard pitch over a bunker to a tight pin.", "Pitch at the flag", "Pitch to the middle of the green"],
  ["short", "Chip from a downhill lie in the rough to a green sloping away.", "Flop it high and soft", "Bump it into the bank and let it trickle"],
  ["short", "Tight, firm lie just off the green. Water behind the green.", "Chip at the pin", "Putt it from off the green"],
  ["short", "Chip over a ridge to a pin at the bottom of a slope.", "Use the slope to finish close", "Stay above the hole for an uphill putt"],
  ["putting", "Downhill 10-footer on a fast green with a foot of break.", "Firm, take some break out", "Die it in at the hole"],
  ["putting", "40-footer up and over a ridge.", "Try to make it", "Lag it inside 3 feet"],
  ["putting", "6-footer to win the match, breaking left to right.", "Firm at the inside edge", "Soft, on a wider line"],
  ["putting", "Uphill 12-footer, slightly breaking.", "Firm at the back of the cup", "Just reach the hole"],
  ["putting", "Short 3-footer with a little break.", "Firm, straight at the back", "Play the break and die it"],
  ["putting", "15-footer with a double break.", "Go for it", "Lag it to tap-in range"]
];
export const trustDeck = (place, n = 8, rnd = Math.random) => shuffle(TRUST.filter(t => t[0] === place), rnd).slice(0, n);
export function trustSummary(shots) {
  const side = k => { const a = shots.filter(s => s.choice === k && s.c && s.r); return { n: a.length, c: avg(a.map(s => s.c)), r: avg(a.map(s => s.r)) }; };
  const go = side("go"), safe = side("safe");
  let insight = "";
  if (go.n && safe.n) {
    if (go.c + 0.5 <= safe.c) insight = "Your commitment drops when you go at it. On the course, pick the safe target unless you fully trust the shot.";
    else if (safe.c + 0.5 <= go.c) insight = "You commit more when you go for it. Playing safe seems to feel like holding back. Commit to the safe target just as fully.";
    else if (go.r + 0.5 <= safe.r) insight = "You commit equally, but safe shots end up better. Smart targets are saving you strokes.";
    else insight = "You trust both choices about the same. Pick the target, then commit like it's the only option.";
  } else if (go.n) insight = "You went for everything. Try the safe option sometimes: a 25-foot putt is a fine result.";
  else if (safe.n) insight = "You played everything safe. Next time, pick a couple of shots you trust and go for them.";
  return { go, safe, insight };
}

// ---------- Shotmaker challenge: 20 shots per area, each at three difficulties.
// [title, [easy, need], [medium, need], [hard, need, inARow?]]. "In a row": a miss starts the count over.
export const DIFFS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
export const MAKER_AREAS = [["range", "Full swing"], ["short", "Short game and bunker"], ["putting", "Putting"]];
export const MAKER = {
  range: [
    ["Fairway wood fade", ["1 fairway wood or hybrid that fades and stays in play", 1], ["2 fairway wood or hybrid fades of about 10 to 20 yards", 2], ["2 in a row: start on one edge of your fairway, fade about 20 yards back to the middle", 2, 1]],
    ["5-iron draw", ["1 5-iron that draws, any amount", 1], ["2 5-iron draws that finish on your target line", 2], ["3 5-iron draws in a row with about 10 yards of curve", 3, 1]],
    ["Dead-straight 8 iron", ["2 8-irons that finish within 15 yards of your target", 2], ["2 8-irons with no curve you can see", 2], ["3 dead-straight 8-irons in a row at your target", 3, 1]],
    ["Low punch", ["1 punch that stays below head height", 1], ["2 low 7-iron knockdowns that finish near your target", 2], ["3 punches in a row that stay low and run up to your target", 3, 1]],
    ["High, soft wedge", ["1 high wedge that lands softly", 1], ["2 high wedges within 10 yards of your target", 2], ["3 high wedges in a row within 5 yards", 3, 1]],
    ["Fairway finder", ["2 drives in a 40-yard fairway (pick two markers)", 2], ["3 drives in a 30-yard fairway", 3], ["3 drives in a row in a 20-yard fairway", 3, 1]],
    ["Three-quarter swing", ["1 three-quarter 7 iron that finishes in balance", 1], ["2 three-quarter 7 irons within 10 yards of each other", 2], ["3 three-quarter swings with 3 different clubs, each within 10 yards of its target", 3]],
    ["Hit the number", ["Pick a yardage: 1 shot within 15 yards of it", 1], ["2 shots within 10 yards of your number", 2], ["3 different yardages in a row, each within 7 yards", 3, 1]],
    ["Hybrid to a green", ["1 hybrid that would hold a big green", 1], ["2 hybrids within 20 yards of your target", 2], ["2 hybrids in a row within 15 yards", 2, 1]],
    ["Into the wind", ["1 smooth swing that flies lower than normal", 1], ["2 one-club-more shots that finish at your target", 2], ["3 in a row: two clubs more, 80% swing, lower flight, at your target", 3, 1]],
    ["Call your shape", ["Call draw or fade before you hit: 1 that matches", 1], ["2 called shots that match", 2], ["4 in a row, switching draw and fade, each as called", 4, 1]],
    ["First-tee drive", ["1 drive in play with your full routine", 1], ["2 drives in play, one ball, full routine each time", 2], ["3 drives in play, imagining a group watching every one", 3, 1]],
    ["Wedge ladder", ["1 wedge each to 50 and 70 yards, within 10 yards", 2], ["50, 70 and 90 yards, each within 7 yards", 3], ["50, 60, 70, 80 and 90 yards in order, each within 5 yards", 5, 1]],
    ["Ball-first strike", ["1 shot with the divot after the ball", 1], ["3 ball-first strikes in a row", 3, 1], ["5 ball-first strikes in a row with a 6 iron", 5, 1]],
    ["Start line", ["Pick a start line: 1 ball that starts on it", 1], ["3 balls that start on your line", 3], ["4 in a row that start on your line", 4, 1]],
    ["Long iron in the air", ["1 long iron or hybrid that gets up and carries", 1], ["2 that finish near your target", 2], ["3 in a row that would hold a green", 3, 1]],
    ["Low tee shot", ["1 driver or 3 wood that flies lower than normal", 1], ["2 low tee shots that stay in play", 2], ["3 low tee shots in a row in a 30-yard fairway", 3, 1]],
    ["Short iron to a tight pin", ["1 9-iron within 15 yards", 1], ["2 9-irons within 10 yards", 2], ["3 9-irons in a row within 7 yards", 3, 1]],
    ["Big curve around a tree", ["1 shot that curves a lot on purpose, either way", 1], ["2 big curves of 20 yards or more that finish near your target", 2], ["Curve one each way around the same marker, both near your target", 2]],
    ["One target, three clubs", ["Hit 3 clubs at one target: 1 within 15 yards", 1], ["3 clubs at one target: 2 within 15 yards", 2], ["3 clubs at one target: all 3 within 10 yards", 3, 1]]
  ],
  short: [
    ["Bunker basics", ["3 bunker shots out and on the green", 3], ["3 bunker shots inside 15 feet", 3], ["3 bunker shots from different lies (clean, sitting down, uphill) inside 5 feet", 3]],
    ["Bump and run", ["2 bump-and-runs that finish on the green", 2], ["2 within 10 feet", 2], ["3 in a row within 6 feet", 3, 1]],
    ["Lob over trouble", ["1 high lob over your bag or a towel that lands softly", 1], ["2 lobs over the bag that stop within 10 feet", 2], ["3 in a row over the bag within 6 feet", 3, 1]],
    ["Landing spot", ["2 chips that land within a club length of your spot", 2], ["3 chips that land on a towel", 3], ["3 in a row on the towel, each with a different club", 3, 1]],
    ["30-yard pitch", ["2 pitches on the green", 2], ["2 within 15 feet", 2], ["3 in a row within 8 feet", 3, 1]],
    ["50-yard pitch", ["2 pitches on the green", 2], ["2 within 20 feet", 2], ["3 within 10 feet", 3]],
    ["Out of thick rough", ["2 chips from thick rough onto the green", 2], ["2 within 10 feet", 2], ["3 in a row within 6 feet", 3, 1]],
    ["Downhill chip", ["2 downhill chips that stay on the green", 2], ["2 within 10 feet", 2], ["2 in a row within 5 feet", 2, 1]],
    ["Uphill chip", ["2 uphill chips that reach the hole", 2], ["2 within 6 feet", 2], ["3 in a row within 4 feet", 3, 1]],
    ["Tight lie", ["2 clean chips off a firm, bare lie", 2], ["2 within 10 feet", 2], ["3 in a row within 6 feet", 3, 1]],
    ["Long bunker shot", ["1 25-yard bunker shot on the green", 1], ["2 within 20 feet", 2], ["2 within 10 feet", 2]],
    ["Buried lie", ["1 buried ball out of the bunker", 1], ["2 buried balls on the green", 2], ["2 buried balls within 15 feet", 2]],
    ["Putter from the fringe", ["2 fringe putts within 6 feet", 2], ["3 within 4 feet", 3], ["3 in a row within 3 feet", 3, 1]],
    ["Up and down", ["1 chip and one putt from an easy spot", 1], ["2 up and downs from medium spots", 2], ["3 in a row from 3 different spots", 3, 1]],
    ["One-club chipping", ["7 iron only: 1 chip within 10 feet", 1], ["7 iron from 2 spots, both within 6 feet", 2], ["7 iron from 3 spots, all within 4 feet", 3, 1]],
    ["Three heights, one hole", ["Low, medium and high chips: 1 within 10 feet", 1], ["2 of the 3 within 8 feet", 2], ["All 3 heights within 6 feet", 3, 1]],
    ["Short-sided", ["1 short-sided chip that stays on the green", 1], ["2 within 10 feet", 2], ["3 in a row within 6 feet", 3, 1]],
    ["Pitch ladder", ["10, 20 and 30 yards, each on the green", 3], ["10, 20 and 30 yards, each within 15 feet", 3], ["10, 20 and 30 yards in order, each within 8 feet", 3, 1]],
    ["Chip in", ["1 chip that touches the hole or stops within 2 feet", 1], ["1 chip-in from 10 to 20 feet", 1], ["2 chip-ins", 2]],
    ["Bunker to a short pin", ["2 bunker shots on the green, pin close to the edge", 2], ["2 within 10 feet", 2], ["3 within 6 feet", 3]]
  ],
  putting: [
    ["Short ones", ["Hole 5 putts from 3 feet", 5], ["Hole 5 in a row from 4 feet", 5, 1], ["Hole 10 in a row from 4 feet", 10, 1]],
    ["Around the hole", ["4 makes from 4 spots around a hole at 3 feet", 4], ["8 makes around the hole at 4 feet", 8], ["8 in a row around the hole at 5 feet", 8, 1]],
    ["Six-footers", ["3 makes from 6 feet", 3], ["3 in a row from 6 feet", 3, 1], ["5 in a row from 6 feet with different breaks", 5, 1]],
    ["30-foot lag", ["2 lags inside 3 feet", 2], ["3 lags inside 3 feet", 3], ["3 in a row inside 2 feet", 3, 1]],
    ["50-foot lag", ["2 lags inside 6 feet", 2], ["2 inside 3 feet", 2], ["3 in a row inside 3 feet", 3, 1]],
    ["Fast downhill", ["2 downhill putts that stop within 4 feet past", 2], ["3 within 3 feet", 3], ["2 makes from 10 feet downhill", 2]],
    ["Big breaker", ["2 big-breaking putts within 3 feet", 2], ["3 within 2 feet", 3], ["1 make from 15 feet with big break", 1]],
    ["Uphill firm", ["3 uphill putts that finish past the hole", 3], ["3 makes from 8 feet uphill", 3], ["5 in a row from 8 feet uphill", 5, 1]],
    ["Distance ladder", ["10, 20, 30 and 40 feet, each inside 4 feet", 4], ["Each inside 3 feet", 4], ["In order, each inside 2 feet", 4, 1]],
    ["Just past the hole", ["3 putts from 15 feet that finish 6 to 18 inches past", 3], ["5 that finish 6 to 18 inches past", 5], ["5 in a row 6 to 18 inches past", 5, 1]],
    ["One read, one try", ["Read it, one try: 1 make from 8 feet", 1], ["2 makes from 10 feet on different holes", 2], ["3 makes from 12 feet on different holes", 3]],
    ["Start line gate", ["5 putts through a tee gate a foot in front of the ball", 5], ["10 through the gate", 10], ["10 in a row through the gate", 10, 1]],
    ["Eyes closed", ["3 putts from 15 feet, eyes closed, inside 4 feet", 3], ["3 inside 3 feet", 3], ["3 in a row inside 2 feet", 3, 1]],
    ["Left to right", ["3 makes from 5 feet breaking left to right", 3], ["3 in a row", 3, 1], ["5 in a row", 5, 1]],
    ["Right to left", ["3 makes from 5 feet breaking right to left", 3], ["3 in a row", 3, 1], ["5 in a row", 5, 1]],
    ["From the collar", ["2 putts from the collar within 4 feet", 2], ["2 within 2 feet", 2], ["1 make from the collar", 1]],
    ["Nine-hole putting", ["6 holes with 2 putts or fewer", 6], ["9 holes with no three-putts", 9, 1], ["9 holes in a row with 2 putts or fewer, all from 20 feet or more", 9, 1]],
    ["Circle of six-footers", ["3 makes from 3 spots at 6 feet", 3], ["6 makes", 6], ["6 in a row", 6, 1]],
    ["Long range", ["2 putts from 60 feet inside 6 feet", 2], ["2 inside 4 feet", 2], ["2 in a row inside 3 feet", 2, 1]],
    ["3, 6, 9 feet", ["1 make each from 3, 6 and 9 feet", 3], ["2 makes from each distance", 6], ["3 makes from 9 feet", 3]]
  ]
};
export function makerTasks(area, diff, n = 6, rnd = Math.random) {
  const d = Math.max(0, DIFFS.findIndex(([k]) => k === diff));
  return shuffle(MAKER[area] || MAKER.range, rnd).slice(0, n).map(([title, ...lv]) => ({ title, label: lv[d][0], need: lv[d][1], row: !!lv[d][2] }));
}
export const makerPar = (tasks, diff) => Math.round(tasks.reduce((a, t) => a + t.need, 0) * ({ easy: 1.6, medium: 2, hard: 2.6 }[diff] || 2));

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
