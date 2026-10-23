// Shot patterns (dispersion), shared by the student app and the coach view.
//
// A "pattern" entry is one range session:
//   { date, mode: "test" | "game", clubs: [{ club, yds }], shots: [shot] }
// A shot: { club, yds, x, y, depth, c, miss }
//   x     yards right (+) or left (-) of the target
//   y     yards long (+) or short (-)
//   depth "" when the student tapped the spot, or "S" | "P" | "L" when they weren't sure how far it went
//         (y is then the middle of that band, and depth spread ignores it)
//   c     contact, 1 (thin or fat) to 5 (pure)
//   miss  for poor strikes (c <= 2): "thin" | "fat" | "toe" | "heel" | ""
//
// On-course patterns come from hole-by-hole rounds (approach result short/long/left/right),
// which are categories, not spots, so they are shown as percentages around a green.
import { CLUBS } from "./roundstats.js";
import { esc } from "./util.js";

export const TEST_SHOTS = 10;
export const GAME_SHOTS = 15;
export const EARLY = 20;          // fewer shots than this with a club = "early read"
export const DEPTHS = [["", "As tapped"], ["S", "Short"], ["P", "Pin high"], ["L", "Long"]];
export const DEPTH_Y = { S: -8, P: 0, L: 8 };
export const MISSES = [["thin", "Thin"], ["fat", "Fat"], ["toe", "Toe"], ["heel", "Heel"]];
const MISS_WORD = { thin: "thin", fat: "fat", toe: "off the toe", heel: "off the heel" };
const MISS_FIX = {
  thin: "Work on staying in your posture through the ball.",
  fat: "Work on where the club meets the ground: after the ball, not before it.",
  toe: "Spray foot powder on the clubface at the range to see where you hit it, and show Karina.",
  heel: "Spray foot powder on the clubface at the range to see where you hit it, and show Karina."
};
export const CONTACT_LABEL = ["", "Thin or fat", "Poor", "OK", "Good", "Pure"];

const SCALE = 5;                   // pixels per yard in the 300 x 300 target
// Longest club first. Understands names like "4 hybrid", "3 wood" or "56°" as well as the standard list.
const clubRank = c => {
  const i = CLUBS.indexOf(c); if (i >= 0) return i;
  const s = String(c || "").toLowerCase(), n = parseInt(s, 10) || 0;
  if (/driver/.test(s)) return 0;
  if (/wood/.test(s)) return 1 + n / 10;
  if (/hybrid/.test(s)) return 3 + n / 10;
  if (/iron/.test(s)) return CLUBS.indexOf(`${n} iron`) >= 0 ? CLUBS.indexOf(`${n} iron`) : 7;
  if (/°|deg/.test(s) || (n >= 44 && n <= 64)) return 10 + n / 100;
  return 99;
};
export const sortClubs = a => [...new Set(a.filter(Boolean))].sort((x, y) => clubRank(x) - clubRank(y));
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a, m) => Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
const yd = v => Math.round(Math.abs(v));
const band = s => s.depth || (s.y < -5 ? "S" : s.y > 5 ? "L" : "P");

// Shots with one club from saved sessions, newest first. mode: "test" | "game" | "" (both).
export function shotsFor(entries, club, mode = "", limit = 40) {
  return entries.slice().sort((a, b) => String(b.date || b.created_at).localeCompare(String(a.date || a.created_at)))
    .filter(e => !mode || e.mode === mode)
    .flatMap(e => (Array.isArray(e.shots) ? e.shots : []).filter(s => s.club === club).reverse())
    .slice(0, limit);
}
export const clubsIn = entries => sortClubs(entries.flatMap(e => (Array.isArray(e.shots) ? e.shots : []).map(s => s.club)));

export function stats(shots) {
  const n = shots.length;
  if (!n) return { n: 0 };
  const xs = shots.map(s => +s.x), ys = shots.map(s => +s.y), exact = shots.filter(s => !s.depth);
  const mx = mean(xs), my = mean(ys);
  const depth = { S: 0, P: 0, L: 0 }; shots.forEach(s => depth[band(s)]++);
  const rated = shots.filter(s => s.c), solid = rated.filter(s => s.c >= 4), poor = rated.filter(s => s.c <= 2);
  const near = a => a.filter(s => Math.hypot(s.x, s.y) <= 10).length;
  const misses = {}; poor.forEach(s => { if (s.miss) misses[s.miss] = (misses[s.miss] || 0) + 1; });
  const ey = exact.map(s => +s.y);
  return {
    n, mx, my, sx: sd(xs, mx), sy: sd(ys, my),
    width: Math.max(...xs) - Math.min(...xs),
    depthSpread: ey.length >= 3 ? Math.max(...ey) - Math.min(...ey) : null,
    exactN: exact.length, exactMy: ey.length ? mean(ey) : null, depth,
    contact: rated.length ? mean(rated.map(s => s.c)) : null,
    solid: { n: solid.length, near: near(solid), mx: solid.length ? mean(solid.map(s => s.x)) : 0 },
    poor: { n: poor.length, near: near(poor), short: poor.filter(s => band(s) === "S").length },
    misses, early: n < EARLY
  };
}

export function missLine(st) {
  if (!st.n) return "–";
  const lr = st.mx >= 1 ? `${yd(st.mx)} right` : st.mx <= -1 ? `${yd(st.mx)} left` : "on line";
  let fb;
  if (st.exactN >= 3) { const m = st.exactMy; fb = m >= 1 ? `${yd(m)} long` : m <= -1 ? `${yd(m)} short` : "pin high"; }
  else { const d = st.depth, top = Object.entries(d).sort((a, b) => b[1] - a[1])[0][0]; fb = { S: "mostly short", P: "mostly pin high", L: "mostly long" }[top]; }
  return `${lr}, ${fb}`;
}
export const depthLine = st => st.depthSpread != null && st.exactN >= st.n / 2 ? `${Math.round(st.depthSpread)} yds` : `${st.depth.S} short · ${st.depth.P} pin · ${st.depth.L} long`;
export const poorLine = st => { const m = Object.entries(st.misses || {}).sort((a, b) => b[1] - a[1]); return m.length ? m.map(([k, v]) => `${v} ${MISS_WORD[k]}`).join(", ") : ""; };

// Plain coaching lines from a pattern. Aim advice waits for 10+ shots.
export function tips(st) {
  if (!st.n || st.n < 3) return ["Hit at least 3 balls to see your pattern."];
  const out = [];
  const top = Object.entries(st.misses).sort((a, b) => b[1] - a[1])[0];
  if (st.poor.n >= 2 && top && top[1] >= Math.ceil(st.poor.n / 2)) out.push(`${top[1]} of your ${st.poor.n} poor strikes were ${MISS_WORD[top[0]]}. ${MISS_FIX[top[0]]}`);
  else if (st.poor.n >= 2 && st.poor.short >= Math.ceil(st.poor.n / 2)) out.push("Your poor strikes are the ones coming up short. Work on contact first; your aim is fine.");
  if (st.solid.n >= 3 && Math.abs(st.solid.mx) >= 4) out.push(`Even your solid shots finish ${yd(st.solid.mx)} yds ${st.solid.mx > 0 ? "right" : "left"}. That's start line or clubface, not contact.`);
  if (st.n >= 10) {
    const aim = [];
    if (Math.abs(st.mx) >= 3) aim.push(`aim ${yd(st.mx)} yds ${st.mx > 0 ? "left" : "right"} of the pin`);
    const short = st.exactN >= 5 ? st.exactMy <= -5 : st.depth.S >= st.n * 0.6;
    const long = st.exactN >= 5 ? st.exactMy >= 5 : st.depth.L >= st.n * 0.6;
    if (short) aim.push("take one more club"); else if (long) aim.push("take one less club");
    if (aim.length) out.push(`On the course, ${aim.join(" and ")}.`);
  }
  if (st.n >= 5 && st.depthSpread != null && st.exactN >= st.n / 2 && out.length < 3)
    out.push(st.depthSpread > st.width ? "Your bigger spread is short to long: work on strike and distance control." : "Your bigger spread is left to right: work on start line and clubface.");
  if (!out.length) out.push(st.contact >= 4 && st.width <= 20 ? "Solid contact and a tight pattern. Make the target smaller, or try game mode." : st.contact != null && st.contact < 3 ? "Contact is the first thing to fix. Direction comes after." : "No strong pattern yet. Keep testing.");
  return out.slice(0, 3);
}

// The target with dots. pending = { x, y } for a tapped but unsaved shot.
export function plotSvg(shots, { st = null, pending = null, id = "", label = "Shot pattern", small = false } = {}) {
  const P = v => Math.max(-28, Math.min(28, +v || 0));
  const X = x => 150 + P(x) * SCALE, Y = y => 150 - P(y) * SCALE;
  const dot = s => {
    const op = s.depth ? ' opacity=".55"' : "";
    if (s.c >= 4 || !s.c) return `<circle cx="${X(s.x)}" cy="${Y(s.y)}" r="6" fill="var(--pine)" stroke="var(--surface)" stroke-width="1.5"${op}/>`;
    if (s.c === 3) return `<circle cx="${X(s.x)}" cy="${Y(s.y)}" r="5" fill="var(--surface)" stroke="var(--pine)" stroke-width="2.5"${op}/>`;
    return `<circle cx="${X(s.x)}" cy="${Y(s.y)}" r="6" fill="var(--a3)" stroke="var(--surface)" stroke-width="1.5"${op}/>`;
  };
  const oval = st && st.n >= 3
    ? `<ellipse cx="${X(st.mx)}" cy="${Y(st.my)}" rx="${Math.min(140, Math.max(8, st.sx * 1.6 * SCALE))}" ry="${Math.min(140, Math.max(8, st.sy * 1.6 * SCALE))}" fill="var(--pine)" fill-opacity=".1" stroke="var(--pine)" stroke-width="1.5"/>
       <path d="M${X(st.mx) - 6} ${Y(st.my)}h12M${X(st.mx)} ${Y(st.my) - 6}v12" stroke="var(--ink)" stroke-width="2"/>` : "";
  const txt = (x, y, t, a = "middle") => `<text x="${x}" y="${y}" text-anchor="${a}" fill="var(--ink-3)" font-size="11" font-weight="600">${t}</text>`;
  return `<svg ${id ? `id="${id}"` : ""} class="pat-svg${small ? " sm" : ""}" viewBox="0 0 300 300" role="img" aria-label="${esc(label)}">
    <rect width="300" height="300" rx="12" fill="var(--a2)" fill-opacity=".1"/>
    <ellipse cx="150" cy="150" rx="78" ry="62" fill="var(--a2)" fill-opacity=".18"/>
    ${[25, 50, 75, 100].map(r => `<circle cx="150" cy="150" r="${r}" fill="none" stroke="var(--line)" stroke-width="1.2" stroke-dasharray="3 4"/>`).join("")}
    ${small ? "" : txt(154, 122, "5", "start") + txt(154, 97, "10", "start") + txt(154, 72, "15", "start") + txt(154, 47, "20 yds", "start")}
    ${txt(150, 16, "Long")}${txt(150, 292, "Short")}${txt(10, 154, "Left", "start")}${txt(290, 154, "Right", "end")}
    ${oval}${shots.map(dot).join("")}
    ${pending ? `<circle cx="${X(pending.x)}" cy="${Y(pending.y)}" r="10" fill="none" stroke="var(--pine)" stroke-width="2" stroke-dasharray="3 2"/><circle cx="${X(pending.x)}" cy="${Y(pending.y)}" r="3.5" fill="var(--pine)"/>` : ""}
    <line x1="150" y1="150" x2="150" y2="130" stroke="var(--ink)" stroke-width="1.6"/><path d="M150 130l13 4.5-13 4.5z" fill="var(--bad)"/>
  </svg>`;
}
// Tap position on the target, in yards.
export function tapToYards(svg, clientX, clientY) {
  const r = svg.getBoundingClientRect();
  const px = (clientX - r.left) / r.width * 300, py = (clientY - r.top) / r.height * 300;
  const c = v => Math.round(Math.max(-28, Math.min(28, v)) * 2) / 2;
  return { x: c((px - 150) / SCALE), y: c((150 - py) / SCALE) };
}
export const legendHtml = () => `<div class="pat-key"><span><i class="k solid"></i>Solid (4–5)</span><span><i class="k ok"></i>OK (3)</span><span><i class="k poor"></i>Poor (1–2)</span><span><i class="k avg">+</i>Average</span></div>`;

// ---------- on the course (from hole-by-hole rounds)
export function courseClubs(rounds) {
  return sortClubs(rounds.flatMap(r => Array.isArray(r.card) ? r.card : []).filter(h => (h.app?.res || []).length).map(h => h.app.club));
}
export function courseSummary(rounds, club = "") {
  const shots = rounds.flatMap(r => Array.isArray(r.card) ? r.card : [])
    .filter(h => h.score != null && (h.app?.res || []).length && (!club || h.app.club === club));
  const c = k => shots.filter(h => h.app.res.includes(k)).length;
  return { n: shots.length, G: c("G"), S: c("S"), Lg: c("Lg"), L: c("L"), R: c("R") };
}
export function courseSvg(sum, { small = false } = {}) {
  const p = k => (sum.n ? Math.round(sum[k] / sum.n * 100) : 0) + "%";
  const big = (x, y, v, l) => `<text x="${x}" y="${y}" text-anchor="middle" fill="var(--ink)" font-size="${small ? 22 : 20}" font-weight="700">${v}</text><text x="${x}" y="${y + 15}" text-anchor="middle" fill="var(--ink-3)" font-size="11" font-weight="600">${l}</text>`;
  return `<svg class="pat-svg${small ? " sm" : ""}" viewBox="0 0 300 300" role="img" aria-label="Approach shots on the course: ${p("G")} on the green">
    <rect width="300" height="300" rx="12" fill="var(--a2)" fill-opacity=".1"/>
    <ellipse cx="150" cy="150" rx="78" ry="62" fill="var(--a2)" fill-opacity=".25" stroke="var(--a2)" stroke-opacity=".5"/>
    ${big(150, 150, p("G"), "On the green")}${big(150, 46, p("Lg"), "Long")}${big(150, 248, p("S"), "Short")}${big(38, 146, p("L"), "Left")}${big(262, 146, p("R"), "Right")}
  </svg>`;
}

// Game mode: every club gets the same number of balls, never the same club twice in a row.
export function gameOrder(n, perClub, rnd = Math.random) {
  const left = Array.from({ length: n }, () => perClub), out = [];
  for (let i = 0; i < n * perClub; i++) {
    const ok = left.map((v, k) => v > 0 && k !== out[out.length - 1] ? k : -1).filter(k => k >= 0);
    const pool = ok.length ? ok : left.map((v, k) => (v > 0 ? k : -1)).filter(k => k >= 0);
    const most = Math.max(...pool.map(k => left[k]));
    const pick = rnd() < 0.6 ? pool.filter(k => left[k] === most) : pool; // keeps the end from being one club in a row
    const k = pick[Math.floor(rnd() * pick.length)];
    out.push(k); left[k]--;
  }
  return out;
}
