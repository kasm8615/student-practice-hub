// Practice game library. Each game has a setup, steps, a score, and a pass mark for three levels.
// place: "range" | "short" (chipping/pitching/bunker area) | "putting" | "course"
// helps: which stats it builds — gir, fairways, putts, updown, mental
// pass: [beginner (20+ hcp), mid (10–20), advanced (under 10)]

export const PLACES = [
  ["range", "Driving range"],
  ["short", "Short-game area"],
  ["putting", "Putting green"],
  ["course", "On the course"]
];

export const GAMES = [
  // ---------- Driving range
  { id: "range9", name: "Play 9 holes on the range", area: "Full swing", place: "range", min: 30, helps: ["gir", "fairways"],
    setup: "Pick 9 holes from a course you know. Use two flags or posts on the range as the edges of your fairway.",
    steps: ["Hole by hole, hit the tee shot you'd hit on the course (driver, wood or iron).", "If it lands between your fairway markers, it's a fairway hit.", "Then hit the approach club you'd have left to a green target.", "Full pre-shot routine on every ball. One ball per shot, no do-overs."],
    score: "1 point per fairway, 1 per green. 18 possible.", pass: ["6 / 18", "9 / 18", "12 / 18"],
    twist: "Miss a fairway? Your next ball has to be a punch shot under an imaginary tree." },
  { id: "corridor", name: "Fairway corridor", area: "Full swing", place: "range", min: 20, helps: ["fairways"],
    setup: "Choose two targets that make a fairway (about 40 yards wide for beginners, 30 for advanced).",
    steps: ["Hit 10 drives, full routine each time.", "Count how many finish inside the corridor.", "After 5 balls, write down your miss (left or right) and pick a swing thought or aim adjustment for the next 5."],
    score: "Drives in the corridor out of 10.", pass: ["4 / 10", "6 / 10", "7 / 10"],
    twist: "Last 3 balls: if you miss one, start the last 3 over." },
  { id: "random", name: "Never the same club twice", area: "Full swing", place: "range", min: 25, helps: ["gir", "mental"],
    setup: "Line up 20 balls. Lay out 5 clubs: driver, a hybrid or wood, 7 iron, 9 iron, wedge.",
    steps: ["Every ball: new club, new target. Never the same club twice in a row.", "Step back, pick a target, do your full routine.", "Call the shot before you hit it (\"7 iron at the 150 flag\")."],
    score: "Balls that finish near your target (within a green's width).", pass: ["7 / 20", "10 / 20", "14 / 20"],
    twist: "This is what the course feels like. If it feels harder than block practice, that's the point." },
  { id: "wedgeladder", name: "Wedge distance ladder", area: "Short game", place: "range", min: 20, helps: ["gir", "updown"],
    setup: "Find flags or yardage signs at 40, 50, 60, 70, 80 and 90 yards (or step them off).",
    steps: ["Hit 2 balls at each distance, going up the ladder, then back down.", "Change only the length of your backswing, same tempo.", "Write down the carry you get with each swing length."],
    score: "Balls that land within your zone (10 yards beginner, 7 mid, 5 advanced).", pass: ["8 / 24", "12 / 24", "16 / 24"],
    twist: "Second time down the ladder, you only get one ball per distance." },
  { id: "stock", name: "Three-club target game", area: "Full swing", place: "range", min: 20, helps: ["gir"],
    setup: "Pick 3 clubs you hit into greens most (e.g. 7 iron, 9 iron, PW) and one target green on the range.",
    steps: ["Hit 5 balls with each club at its own target.", "A green hit = within about 10 yards of the flag.", "Rest 20 seconds between balls; treat each like an approach on the course."],
    score: "Greens hit out of 15.", pass: ["4 / 15", "7 / 15", "10 / 15"],
    twist: "Switch clubs every ball instead of every 5." },
  { id: "musthit", name: "5 in a row", area: "Mental", place: "range", min: 15, helps: ["mental", "fairways"],
    setup: "Pick one club you'll need this week and a target about 30 yards wide.",
    steps: ["Hit at the target until you land 5 in a row inside it.", "Miss one and the count goes back to 0.", "Full routine every ball, especially when you're at 3 or 4."],
    score: "How many balls it took.", pass: ["under 30 balls", "under 20 balls", "under 12 balls"],
    twist: "Advanced: make it 7 in a row, or narrow the target." },
  { id: "routine", name: "Routine reps", area: "Mental", place: "range", min: 15, helps: ["mental"],
    setup: "15 balls, any club. The goal is your routine, not the shot.",
    steps: ["Before each ball: pick a small target, one practice swing, one breath, go.", "After each ball, rate your commitment 1 to 3 (3 = fully committed, didn't think about mechanics).", "Don't judge the result, only the routine."],
    score: "Total commitment points out of 45.", pass: ["30 / 45", "35 / 45", "40 / 45"],
    twist: "Time your routine with a friend. It should take about the same time every ball." },
  { id: "shape", name: "Call your shape", area: "Full swing", place: "range", min: 20, helps: ["gir"], level: "advanced",
    setup: "7 iron, 12 balls, one target.",
    steps: ["Before each ball, call it: straight, draw or fade.", "Hit 4 of each, mixed up.", "It counts if it curves the way you called and finishes near the target."],
    score: "Shots that match your call out of 12.", pass: ["4 / 12", "6 / 12", "8 / 12"],
    twist: "Add a low and a high version of each shape." },
  { id: "trouble", name: "Trouble shots", area: "Full swing", place: "range", min: 15, helps: ["mental", "gir"],
    setup: "6 iron or 7 iron. Imagine you're under trees and need to keep it low.",
    steps: ["Ball back in your stance, hands ahead, 3/4 swing, hold the finish low.", "Hit 10 punch shots that stay under an imaginary branch (about head height 30 yards out).", "Then hit 5 to a target 120 yards out keeping it low."],
    score: "Punch shots that stay low and go straight, out of 15.", pass: ["6 / 15", "9 / 15", "12 / 15"],
    twist: "This is the shot that saves you from doubles. Count how many times you needed it last round." },

  // ---------- Short-game area
  { id: "updown9", name: "Up-and-down challenge", area: "Short game", place: "short", min: 30, helps: ["updown", "putts"],
    setup: "Pick 9 spots around a practice green: easy lies, rough, downhill, short-sided, a bunker if you have one.",
    steps: ["From each spot, play one ball: chip or pitch, then putt out.", "No mulligans, read every putt.", "Write down which spots cost you."],
    score: "Up-and-downs (in 2 shots) out of 9.", pass: ["2 / 9", "3 / 9", "5 / 9"],
    twist: "Tour players get up and down about 6 in 10. Track your number every week." },
  { id: "towel", name: "Landing spot towel", area: "Short game", place: "short", min: 15, helps: ["updown"],
    setup: "Lay a towel (or a tee circle) about 1 yard onto the green. Pick a hole 10 to 15 yards past it.",
    steps: ["Chip 10 balls trying to land them on the towel.", "Watch how far they roll after landing.", "Then move the towel and repeat with a different club."],
    score: "Balls landed on the towel out of 10.", pass: ["3 / 10", "5 / 10", "7 / 10"],
    twist: "Hit the same chip with 3 clubs (8 iron, PW, SW) and learn the roll each one gives you." },
  { id: "par18", name: "Par-18 short-game course", area: "Short game", place: "short", min: 30, helps: ["updown", "putts"],
    setup: "Make 9 \"holes\" around the green with different shots: 3 chips, 3 pitches, 3 tricky lies.",
    steps: ["Each hole is par 2: one shot onto the green, one putt.", "Play one ball per hole and putt out every time.", "Keep score like a real round."],
    score: "Total strokes for the 9 holes (par 18).", pass: ["27 or less", "24 or less", "21 or less"],
    twist: "Play it with a friend for match play, or try to beat your last score." },
  { id: "bunker", name: "Bunker escape test", area: "Short game", place: "short", min: 20, helps: ["updown"],
    setup: "A practice bunker. Draw a line in the sand 2 inches behind each ball.",
    steps: ["10 balls: just get out. Splash the sand at your line, full finish.", "Then 10 balls: get out and finish within 10 feet of the hole (15 feet for beginners).", "Keep the club face open and accelerate through the sand."],
    score: "Out in one (of 10) and close (of 10).", pass: ["7 out, 2 close", "9 out, 4 close", "10 out, 6 close"],
    twist: "Last 3 balls from a tougher lie: buried or uphill." },
  { id: "pitchladder", name: "Pitching ladder 10-20-30", area: "Short game", place: "short", min: 15, helps: ["updown"],
    setup: "Three targets at 10, 20 and 30 yards (towels, buckets or tees).",
    steps: ["3 balls at 10, 3 at 20, 3 at 30, then back down.", "Same tempo, change only the length of the swing.", "Note which distance is hardest."],
    score: "Balls finishing within 2 club lengths of the target, out of 18.", pass: ["6 / 18", "9 / 18", "12 / 18"],
    twist: "Random order: have a friend call the distance right before you swing." },
  { id: "onehand", name: "Worst-lie chipping", area: "Short game", place: "short", min: 15, helps: ["updown", "mental"],
    setup: "Drop 10 balls in bad spots: thick rough, bare lie, downhill, short-sided.",
    steps: ["Pick your shot and club for each lie before you set up.", "Chip and putt out.", "The goal is avoiding big numbers, not holing out."],
    score: "Balls you got on the green and two-putted or better, out of 10.", pass: ["5 / 10", "7 / 10", "9 / 10"],
    twist: "On the course these are the shots that turn bogeys into doubles." },

  // ---------- Putting green
  { id: "circle", name: "3-foot circle", area: "Putting", place: "putting", min: 10, helps: ["putts", "mental"],
    setup: "Put 8 balls in a circle around a hole, 3 feet away (about one putter length).",
    steps: ["Go around the circle, full routine each putt.", "Miss one and start the circle over.", "Pick a flat hole first, then one on a slope."],
    score: "Tries it took to make all 8.", pass: ["5 tries or less", "3 tries or less", "first try"],
    twist: "Advanced: move out to 4 feet, or do two circles in a row." },
  { id: "lag", name: "Lag zone", area: "Putting", place: "putting", min: 15, helps: ["putts"],
    setup: "Pick a hole and putt from 20, 30 and 40 feet. Imagine a 3-foot circle around the hole.",
    steps: ["3 balls from each distance.", "Success = the ball finishes inside the 3-foot circle.", "Watch your speed, not the line."],
    score: "Putts finishing inside 3 feet, out of 9.", pass: ["4 / 9", "6 / 9", "8 / 9"],
    twist: "Putt to the fringe instead of a hole: get it as close to the edge as possible without going over." },
  { id: "putt18", name: "18-hole putting course", area: "Putting", place: "putting", min: 25, helps: ["putts", "mental"],
    setup: "Play to 18 different holes on the practice green, mixing short, medium and long putts.",
    steps: ["One ball, par 2 on every hole.", "Read every putt like it counts.", "Keep score."],
    score: "Total putts for 18 holes (par 36).", pass: ["40 or less", "36 or less", "33 or less"],
    twist: "This is your real putts-per-round number. Compare it to your rounds." },
  { id: "five5", name: "Pressure 5-footers", area: "Mental", place: "putting", min: 10, helps: ["putts", "mental"],
    setup: "Pick a 5-foot putt with a little break.",
    steps: ["You need 10 in a row to finish.", "Miss one and go back to zero.", "Full routine every time, especially after 7 or 8."],
    score: "How many putts it took to make 10 in a row.", pass: ["under 30", "under 20", "under 14"],
    twist: "Start at 3 feet if 5 feet is too hard. Move back as you improve." },
  { id: "gate", name: "Start-line gate", area: "Putting", place: "putting", min: 10, helps: ["putts"],
    setup: "Push two tees into the green just wider than your ball, about 1 foot in front of the ball on a straight 6-foot putt.",
    steps: ["Roll 20 putts through the gate.", "The putt only counts if it goes through the gate AND in the hole.", "Keep your head still until you hear it drop."],
    score: "Through the gate and in, out of 20.", pass: ["10 / 20", "14 / 20", "17 / 20"],
    twist: "Narrow the gate as you get better." },
  { id: "ladderup", name: "Distance ladder 10-20-30-40", area: "Putting", place: "putting", min: 15, helps: ["putts"],
    setup: "Put tees at 10, 20, 30 and 40 feet in a straight line on the green.",
    steps: ["Putt one ball to each tee in order, trying to finish each one past the last ball but short of the next tee.", "If one comes up short or goes too far, start over.", "Then go back down."],
    score: "Did you finish the ladder? How many tries?", pass: ["finished in 4 tries", "finished in 3 tries", "finished in 2 tries"],
    twist: "Close your eyes after you hit it and guess where it finished before you look." },

  // ---------- On the course
  { id: "stat9", name: "Stats round", area: "On course", place: "course", min: 90, helps: ["gir", "fairways", "putts", "updown"],
    setup: "Play 9 or 18 holes. Bring a scorecard or your phone.",
    steps: ["On every hole write: fairway (Y/N), green in regulation (Y/N), number of putts, up-and-down (Y/N) when you missed the green.", "Play normally. The goal is honest numbers.", "Log the round in the app afterwards."],
    score: "Your fairways, greens, putts and up-and-downs.", pass: ["log every hole", "log every hole", "log every hole"],
    twist: "Compare to the Goals calculator to see which stat costs you the most strokes." },
  { id: "from150", name: "Approach-only round", area: "On course", place: "course", min: 60, helps: ["gir", "updown"],
    setup: "Play 9 holes on a quiet afternoon. Skip the tee shot.",
    steps: ["On every hole, drop a ball in the fairway about 150 yards out (100 for beginners).", "Play the hole out from there.", "Par is 3 from that spot on every hole."],
    score: "Score for 9 holes (par 27).", pass: ["40 or less", "34 or less", "29 or less"],
    twist: "Tour players average around par from 150. See how close you get." },
  { id: "oneclub", name: "Fairway finder round", area: "On course", place: "course", min: 90, helps: ["fairways", "mental"],
    setup: "Play 9 holes. On every par 4 and par 5, tee off with the club you hit straightest (hybrid, 5 wood or iron).",
    steps: ["Take the trouble out of play.", "Count fairways hit and compare to your normal round.", "Notice how your score changes when you're always in play."],
    score: "Fairways hit, and your 9-hole score.", pass: ["4 fairways", "5 fairways", "6 fairways"],
    twist: "Next time, use driver only on holes where a miss doesn't cost a penalty." },
  { id: "scramble", name: "Scrambling round", area: "On course", place: "course", min: 90, helps: ["updown"],
    setup: "Play 9 holes when the course is quiet.",
    steps: ["Every time you hit a green, also toss a second ball into a missed spot just off the green.", "Play the second ball up and down too (it doesn't count for your score).", "Track up-and-downs for all the balls you chipped."],
    score: "Up-and-downs made, out of total tries.", pass: ["25%", "35%", "50%"],
    twist: "The golfers who shoot in the 70s save par about half the time." },
  { id: "worst", name: "Worst-ball 6 holes", area: "On course", place: "course", min: 60, helps: ["mental", "gir"], level: "advanced",
    setup: "Play 6 holes with 2 balls on every shot.",
    steps: ["Hit both balls, pick the WORSE one, and play both from there.", "Putt both. The worse score counts.", "It shows you exactly where your misses cost you."],
    score: "Your worst-ball score for 6 holes.", pass: ["+12 or better", "+9 or better", "+6 or better"],
    twist: "Beginners: play best-ball instead, pick the better shot each time." },
  { id: "routineRound", name: "Routine round", area: "Mental", place: "course", min: 90, helps: ["mental"],
    setup: "Play 9 holes. Keep a second score on your card: your routine.",
    steps: ["Every full shot: did you do your full pre-shot routine and commit? Give yourself a check.", "After a bad hole, take 3 breaths and say your reset word before the next tee.", "Your normal score doesn't matter today."],
    score: "Full shots with a full, committed routine.", pass: ["60% of shots", "75% of shots", "90% of shots"],
    twist: "Write down the hole where you lost it, and why. Bring it to your next lesson." },
  { id: "nothree", name: "No 3-putts round", area: "Putting", place: "course", min: 90, helps: ["putts"],
    setup: "Play 9 holes with one goal: never 3-putt.",
    steps: ["On every first putt longer than 15 feet, your only job is speed: get it inside 3 feet.", "Mark each green: 1, 2 or 3 putts.", "Log the round with your putts afterwards."],
    score: "3-putts in 9 holes.", pass: ["2 or fewer", "1 or fewer", "0"],
    twist: "Most extra putts come from bad speed on long putts, not missed short ones." },

  // ---------- Swing change
  { id: "slowreps", name: "Slow-motion reps", area: "Full swing", place: "range", min: 20, helps: ["gir"], only: "swing",
    setup: "Your swing change from Karina's last lesson. A mid iron, no target needed.",
    steps: ["10 rehearsal swings without a ball at half speed. Exaggerate the new feel.", "10 balls at half speed. Stop at the finish and check your position.", "10 balls at three-quarter speed keeping the same feel.", "Ball flight doesn't matter today. Only the feel."],
    score: "Reps where you felt the new move, out of 20 balls.", pass: ["10 / 20", "13 / 20", "16 / 20"],
    twist: "It's normal to hit it worse for a while during a swing change. Don't go back to the old swing to chase good shots." },
  { id: "video3", name: "Film and compare", area: "Full swing", place: "range", min: 15, helps: ["gir"], only: "swing",
    setup: "Prop your phone at hip height, behind you looking down the target line (same angle as your lesson video).",
    steps: ["Film 3 normal swings.", "Watch them next to Karina's lesson video or her notes. Is the change showing up?", "Hit 10 balls working on what you saw, then film 3 more.", "Send the best one to Karina from the Notes tab."],
    score: "Did the change show up on the second video? Yes / partly / no.", pass: ["partly", "partly", "yes"],
    twist: "Feel and real are often different. The video tells you the truth." },
  { id: "blockrandom", name: "Drill, then ball, then target", area: "Full swing", place: "range", min: 25, helps: ["gir"], only: "swing",
    setup: "One club. Karina's drill for your swing change.",
    steps: ["5 balls doing the drill exactly as Karina showed you.", "5 balls with a normal swing keeping the drill feel, no target.", "5 balls at a target with your full routine. Did the feel stay?", "Repeat the cycle 2 or 3 times."],
    score: "Target shots where you kept the new feel, out of 15.", pass: ["5 / 15", "8 / 15", "11 / 15"],
    twist: "This bridge from drill to target is how a swing change makes it to the course." },

  // ---------- Tournament week
  { id: "warmup", name: "Rehearse your pre-round warm-up", area: "Mental", place: "range", min: 30, helps: ["mental"], only: "tournament",
    setup: "Do the exact warm-up you'll do on tournament day, timed.",
    steps: ["5 min stretching, then wedges, mid irons, hybrid or wood, driver: 5 balls each.", "Last 5 balls: play the first 3 holes of the course on the range.", "10 min on the putting green: 5 lag putts, then 3-footers until you make 5 in a row.", "No fixing. Today you play with what you've got."],
    score: "Did you finish the whole routine in the time you'll have? Yes / no.", pass: ["yes", "yes", "yes"],
    twist: "Write your warm-up on a card and keep it in your bag for tournament day." },
  { id: "gameplan", name: "Course game plan", area: "On course", place: "course", min: 30, helps: ["mental", "fairways"], only: "tournament",
    setup: "The tournament course scorecard or a map app. Can be done at home.",
    steps: ["For every hole, pick your tee club and the side of the fairway to aim for.", "Mark where NOT to miss (water, out of bounds, short-sided).", "Pick a safe target on any hole that scares you.", "Write it on your scorecard or in your notes."],
    score: "Holes with a clear plan, out of 18.", pass: ["18 / 18", "18 / 18", "18 / 18"],
    twist: "Share your plan with Karina in Notes. She'll check it." },

  // ---------- With friends
  { id: "closest", name: "Closest to the pin", area: "Full swing", place: "range", min: 15, helps: ["gir"], only: "fun",
    setup: "Play with friends. Everyone picks one club and the same target.",
    steps: ["Each player hits one ball. Closest wins the point.", "Winner picks the next club and target.", "Play to 7 points."],
    score: "Points won.", pass: ["2", "3", "4"],
    twist: "Losers pick up the balls." },
  { id: "horse", name: "Putting HORSE", area: "Putting", place: "putting", min: 15, helps: ["putts"], only: "fun",
    setup: "2 or more players on a putting green.",
    steps: ["First player picks any putt. If they make it, everyone else has to make the same putt.", "Miss and you get a letter: H, O, R, S, E.", "Spell HORSE and you're out."],
    score: "Did you win?", pass: ["played a full game", "won a game", "won 2 games"],
    twist: "Long putts only count if they finish within a putter length." },
  { id: "chipoff", name: "Chip-off", area: "Short game", place: "short", min: 15, helps: ["updown"], only: "fun",
    setup: "2 or more players around a practice green.",
    steps: ["Take turns picking a spot. Everyone chips one ball.", "Closest gets 1 point, a chip-in gets 3.", "First to 10 wins."],
    score: "Points scored.", pass: ["3", "5", "7"],
    twist: "Winner of each hole has to chip the next one with a different club." }
];

// What a week looks like for each kind of student week.
export const WEEKS = [
  ["normal", "Just improving"],
  ["tournament", "Tournament this week"],
  ["swing", "Working on a swing change"],
  ["fun", "Playing with friends"]
];
// Games that suit each week, best first. Games marked "only" show up only in their week.
const WEEK_PICKS = {
  tournament: ["warmup", "range9", "random", "routine", "musthit", "updown9", "par18", "worst", "five5", "lag", "circle", "putt18", "gameplan", "routineRound", "nothree", "from150", "stat9"],
  swing: ["slowreps", "blockrandom", "video3", "corridor", "stock", "wedgeladder", "towel", "pitchladder", "bunker", "gate", "ladderup", "lag", "stat9", "oneclub"],
  fun: ["closest", "range9", "trouble", "chipoff", "par18", "horse", "putt18", "worst", "scramble", "stat9"]
};
export const WEEK_TIPS = {
  tournament: d => d != null && d <= 2
    ? "Tournament in " + (d <= 0 ? "less than a day" : d === 1 ? "1 day" : "2 days") + ": keep practice short. Warm-up rehearsal, short game and putting, then rest. No swing changes now."
    : "Tournament week: practice like you'll play. Change clubs and targets every shot, keep score, use your full routine. Fix nothing big; trust what you have.",
  swing: () => "Swing change week: slow reps, lots of them, one feel at a time. Film yourself. Bad shots are normal right now. Don't chase results.",
  fun: () => "Playing with friends: keep it fun and competitive. A quick warm-up and some games you can play together.",
  normal: () => ""
};

const LEVELS = ["beginner", "mid", "advanced"];
export const levelOf = hcp => { const h = parseFloat(hcp); return isNaN(h) ? 1 : h >= 20 ? 0 : h >= 10 ? 1 : 2; };
export const levelName = i => LEVELS[i];

// What a student should work on: biggest stat gap from their rounds, else words in their goals.
const STAT_NAMES = { gir: "greens in regulation", fairways: "fairways", putts: "putting", updown: "up-and-downs", mental: "your mental game" };
export function focusFor({ gapName, goalsText }) {
  const fromGap = { "Greens in regulation": "gir", "Fairways hit": "fairways", "Putts": "putts", "Up & down": "updown" }[gapName];
  if (fromGap) return { key: fromGap, why: `Your biggest gap is ${STAT_NAMES[fromGap]}, compared with golfers at your target score.` };
  const t = String(goalsText || "").toLowerCase();
  const rules = [[/putt/, "putts"], [/green|gir|approach|iron/, "gir"], [/fairway|driv|tee shot/, "fairways"], [/chip|up.and.down|short game|bunker|wedge/, "updown"], [/routine|mental|focus|calm|nerv|confiden|reset/, "mental"]];
  for (const [re, k] of rules) if (re.test(t)) return { key: k, why: `Picked to match your goal about ${STAT_NAMES[k]}.` };
  return null;
}

// Builds a session for a place and time: first game targets the focus, the rest fill the time.
export function buildSession({ place, minutes, level, focus, seed = 0, exclude = [], week = "normal", extra = [], daysOut = null }) {
  let fits = extra.filter(g => g.place === place).concat(GAMES.filter(g => g.place === place && (!g.level || level === 2) && (!g.only || g.only === week) && !exclude.includes(g.id)));
  const picks = WEEK_PICKS[week];
  if (picks) {
    // Week games first (in their order), then the rest. Close to a tournament: short game and putting only, short sessions.
    const rank = g => g.drill ? -1 : picks.includes(g.id) ? picks.indexOf(g.id) : 99;
    fits = fits.slice().sort((a, b) => rank(a) - rank(b));
    if (week === "tournament" && daysOut != null && daysOut <= 2) minutes = Math.min(minutes, 45);
    const top = fits.filter(g => rank(g) < 99);
    const pool = top.length ? top : fits;
    const picked = []; let left = minutes;
    for (const g of [...pool.slice(seed % Math.max(1, pool.length)), ...pool.slice(0, seed % Math.max(1, pool.length))]) {
      if (g.min <= left || (!picked.length)) { picked.push(g); left -= g.min; }
      if (left < 10 || picked.length >= 3 || place === "course") break;
    }
    return picked;
  }
  const rot = (arr, n) => arr.length ? arr.slice(n % arr.length).concat(arr.slice(0, n % arr.length)) : arr;
  const first = rot(fits.filter(g => !focus || g.helps.includes(focus)), seed);
  const rest = rot(fits, seed * 3 + 1);
  const picked = [];
  let left = minutes;
  for (const g of [...first.slice(0, 1), ...rest]) {
    if (picked.includes(g)) continue;
    if (g.min <= left || (!picked.length && place === "course")) { picked.push(g); left -= g.min; }
    if (left < 10 || picked.length >= 3 || place === "course") break;
  }
  if (!picked.length && fits.length) picked.push(first[0] || rest[0]);
  return picked;
}

// Karina's assigned drills, as session games (used in swing-change weeks).
export function drillGames(drills) {
  const placeOf = c => c === "Putting" ? "putting" : c === "Short game" || c === "Pitching" || c === "Chipping" || c === "Bunker" ? "short" : "range";
  return drills.filter(d => d.status !== "Mastered").map(d => ({
    id: "drill-" + d.id, drill: true, name: d.name + " (Karina's drill)", area: d.category || "Full swing", place: placeOf(d.category), min: 15, helps: [],
    setup: d.notes || "The drill from your lesson.", steps: ["Do the drill exactly as Karina showed you, slowly at first.", d.goal ? `Then score it: ${d.target || "successful reps"}.` : "Then do 10 reps at normal speed keeping the feel.", "Log your score on the drill in the Lessons tab."],
    score: d.goal ? `${d.target || "Successful reps"}, out of ${d.of || 10}.` : "Reps with the right feel.", pass: Array(3).fill(d.goal ? `${d.goal} / ${d.of || 10}` : "7 / 10"),
    twist: "Film one rep and send it to Karina."
  }));
}
