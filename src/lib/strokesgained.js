// Strokes gained from hole-by-hole rounds (Full mode).
// Baseline: expected strokes to hole out for a PGA Tour player, approximated from Mark Broadie's
// published benchmarks ("Every Shot Counts"). Amateur numbers come out negative; the useful part
// is which category loses the most.
//
// Per hole we know: hole length (h.yds), the shot into the green (h.app.yds), the chip/bunker
// distance when the green was missed (h.sg.yds), the first putt (h.fp) and putts.
//   Putting        = E(first putt) − putts
//   Around green   = E(chip distance, lie) − chip shots − E(first putt)
//   Approach       = E(approach distance, lie) − 1 − approach penalties − E(next spot)
//   Off the tee    = E(hole length) − score − the three above   (par 4/5: tee shot, lay-ups, recoveries, tee penalties)
//   Par 3s: the tee shot is the approach, so everything goes to Approach.

export const SG_SOURCE = "Compared with a PGA Tour player (Mark Broadie's strokes-gained benchmarks).";
export const SG_CATS = [["ott", "Off the tee"], ["app", "Approach"], ["arg", "Around the green"], ["putt", "Putting"]];
const DEFAULT_CHIP_YDS = 15;

// [distance, expected strokes]
const T = {
  putt: [[1, 1.0], [2, 1.01], [3, 1.04], [4, 1.13], [5, 1.23], [6, 1.34], [7, 1.42], [8, 1.5], [9, 1.56], [10, 1.61], [15, 1.78], [20, 1.87], [30, 1.98], [40, 2.06], [50, 2.14], [60, 2.21], [90, 2.4]], // feet
  tee: [[100, 2.92], [120, 2.99], [140, 2.97], [160, 2.99], [180, 3.05], [200, 3.12], [220, 3.17], [240, 3.25], [260, 3.45], [280, 3.65], [300, 3.71], [320, 3.79], [340, 3.86], [360, 3.92], [380, 3.96], [400, 3.99], [420, 4.02], [440, 4.08], [460, 4.17], [480, 4.28], [500, 4.41], [520, 4.54], [540, 4.65], [560, 4.74], [580, 4.79], [600, 4.82]],
  fairway: [[5, 2.1], [10, 2.18], [20, 2.4], [30, 2.52], [40, 2.6], [60, 2.7], [80, 2.75], [100, 2.8], [120, 2.85], [140, 2.91], [160, 2.98], [180, 3.08], [200, 3.19], [220, 3.32], [240, 3.45], [260, 3.58], [300, 3.85]],
  rough: [[5, 2.3], [10, 2.43], [20, 2.59], [30, 2.7], [40, 2.78], [60, 2.91], [80, 2.96], [100, 3.02], [120, 3.08], [140, 3.15], [160, 3.23], [180, 3.31], [200, 3.42], [220, 3.53], [240, 3.64], [300, 3.95]],
  sand: [[5, 2.35], [10, 2.43], [20, 2.53], [30, 2.66], [40, 2.82], [60, 3.15], [80, 3.24], [100, 3.23], [120, 3.21], [140, 3.22], [160, 3.28], [180, 3.4], [200, 3.55], [240, 3.85]]
};

const has = v => v !== "" && v != null && !isNaN(+v) && +v > 0;

export function expected(dist, lie) {
  const t = T[lie];
  const d = +dist;
  if (d <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (d <= t[i][0]) { const [a, b] = [t[i - 1], t[i]]; return a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]); }
  }
  // Past the table: carry on at the last slope.
  const [a, b] = [t[t.length - 2], t[t.length - 1]];
  return b[1] + (b[1] - a[1]) * (d - b[0]) / (b[0] - a[0]);
}

const approachLie = h => h.par === 3 ? "tee" : h.par === 4 && (h.tee?.res === "L" || h.tee?.res === "R") && !h.rec ? "rough" : "fairway";

// Strokes gained for one hole. A category is null when the hole doesn't have the numbers for it.
export function holeSG(h) {
  const out = { ott: null, app: null, arg: null, putt: null, total: null, est: false };
  if (!has(h.score)) return out;
  const putts = h.putts == null || h.putts === "" ? null : +h.putts;
  const res = h.app?.res || [];
  const onGreen = res.includes("G"), missed = res.length && !onGreen;
  const chipped = missed && h.sg && h.sg.kind !== "putt";

  // Putting: needs the first putt.
  let ePutt = null;
  if (putts === 0) ePutt = 0;
  else if (putts != null && has(h.fp)) { ePutt = expected(h.fp, "putt"); out.putt = ePutt - putts; }

  // Around the green.
  let eNext = null; // expected strokes where the approach finished
  if (chipped) {
    const yds = has(h.sg.yds) ? +h.sg.yds : (out.est = true, DEFAULT_CHIP_YDS);
    const eChip = expected(yds, h.sg.kind === "bunker" ? "sand" : "rough");
    if (ePutt != null) out.arg = eChip - (+h.sg.shots || 1) - ePutt;
    eNext = eChip;
  } else if (onGreen || missed) eNext = ePutt;

  // Approach.
  const appPen = h.penFrom === "app" ? +h.pen || 0 : 0;
  const startYds = h.par === 3 && has(h.yds) ? +h.yds : has(h.app?.yds) ? +h.app.yds : null;
  if (startYds != null && eNext != null) out.app = expected(startYds, approachLie(h)) - 1 - appPen - eNext;

  // Whole hole, and what's left goes to off the tee (par 3s: to approach).
  if (has(h.yds)) {
    out.total = expected(h.yds, "tee") - +h.score;
    const known = (out.app ?? NaN) + (out.arg ?? 0) + (out.putt ?? 0);
    const complete = out.app != null && (!chipped || out.arg != null) && (putts === 0 || out.putt != null);
    if (complete) {
      const rest = out.total - known;
      if (h.par === 3) out.app += rest; else out.ott = rest;
    }
  }
  return out;
}

// Totals for a round, plus how many holes fed each category.
export function roundSG(card) {
  const s = { ott: 0, app: 0, arg: 0, putt: 0, total: 0, n: { ott: 0, app: 0, arg: 0, putt: 0, total: 0 }, holes: 0, est: 0 };
  (card || []).forEach(h => {
    if (!has(h.score)) return;
    s.holes++;
    const x = holeSG(h);
    ["ott", "app", "arg", "putt", "total"].forEach(k => { if (x[k] != null) { s[k] += x[k]; s.n[k]++; } });
    if (x.est && x.arg != null) s.est++;
  });
  s.any = SG_CATS.some(([k]) => s.n[k]);
  return s;
}

// Average per 18 holes across several rounds (each category scaled by the holes it covers).
export function averageSG(rounds, n = 5) {
  const r = rounds.filter(x => Array.isArray(x.card) && x.mode === "full")
    .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, n)
    .map(x => roundSG(x.card)).filter(x => x.any);
  if (!r.length) return null;
  const out = { rounds: r.length, n: {} };
  ["ott", "app", "arg", "putt", "total"].forEach(k => {
    const holes = r.reduce((a, x) => a + x.n[k], 0), sum = r.reduce((a, x) => a + x[k], 0);
    out.n[k] = holes; out[k] = holes ? sum / holes * 18 : null;
  });
  return out;
}

// Plain facts for the AI review and the coach.
export function sgSummary(s) {
  if (!s || !s.any) return null;
  const r = v => Math.round(v * 10) / 10;
  const o = { baseline: "PGA Tour" };
  SG_CATS.forEach(([k, l]) => { if (s.n[k]) o[k] = { label: l, strokes: r(s[k]), holes: s.n[k] }; });
  if (s.n.total) o.total = { strokes: r(s.total), holes: s.n.total };
  return o;
}

const fmt = v => { const r = Math.round(v * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(1); };

// Bars for one round (s from roundSG) or an average (from averageSG, per18 = true).
export function sgHtml(s, esc, { per18 = false, title = "Strokes gained" } = {}) {
  if (!s) return "";
  const cats = SG_CATS.filter(([k]) => (per18 ? s[k] != null : s.n[k]));
  if (!cats.length) return `<div class="sg"><h3 class="sh3">${esc(title)}</h3><p class="muted">Track in Full mode and fill in the distances (hole length, shot into the green, chips and first putt) to see strokes gained.</p></div>`;
  const max = Math.max(1, ...cats.map(([k]) => Math.abs(s[k])));
  const worst = cats.reduce((a, c) => (s[c[0]] < (a ? s[a[0]] : Infinity) ? c : a), null);
  const best = cats.reduce((a, c) => (s[c[0]] > (a ? s[a[0]] : -Infinity) ? c : a), null);
  const missing = per18 ? [] : SG_CATS.filter(([k]) => s.n[k] < s.holes).map(([k, l]) => `${l.toLowerCase()} ${s.n[k]}/${s.holes}`);
  return `<div class="sg"><h3 class="sh3">${esc(title)}</h3>
    ${(per18 ? s.total != null : s.n.total) ? `<p class="sg-total"><b>${fmt(s.total)}</b> ${per18 ? "per 18 holes" : `over ${s.n.total} hole${s.n.total > 1 ? "s" : ""}`}</p>` : ""}
    <div class="sg-bars">${cats.map(([k, l]) => { const w = Math.abs(s[k]) / max * 50; return `<div class="sg-row"><span>${esc(l)}</span>
      <div class="sg-track"><i class="${s[k] < 0 ? "neg" : "pos"}" style="${s[k] < 0 ? `right:50%` : `left:50%`};width:${w.toFixed(1)}%"></i></div><b>${fmt(s[k])}</b></div>`; }).join("")}</div>
    ${cats.length > 1 && worst && s[worst[0]] < 0 ? `<p class="bench-tip"><b>Most strokes lost: ${esc(worst[1].toLowerCase())}.</b>${best && best !== worst ? ` Strongest: ${esc(best[1].toLowerCase())}.` : ""} That's where practice pays off first.</p>` : ""}
    <p class="bench-src">${esc(SG_SOURCE)} Below zero is normal for amateurs; compare the categories with each other.${per18 ? ` Average of your last ${s.rounds} Full-mode round${s.rounds > 1 ? "s" : ""}, scaled to 18 holes.` : ""}${missing.length ? ` Holes with the distances: ${esc(missing.join(", "))}.` : ""}${!per18 && s.est ? ` ${s.est} chip distance${s.est > 1 ? "s" : ""} not entered, ${DEFAULT_CHIP_YDS} yds used.` : ""}</p></div>`;
}
