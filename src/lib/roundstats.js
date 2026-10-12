// Hole-by-hole round data: totals and miss patterns.
// A hole: { n, par, score, putts, fp (first putt, ft), pen, penFrom, rec,
//   tee: { res: "fw"|"L"|"R", start: "curve"|"off", club },            par 4/5 only
//   app: { res: ["G"] or e.g. ["S","R"], club, yds },                     the shot into the green (par 3 tee shot)
//   sg:  { kind: "chip"|"bunker", shots, land: "on"|"short"|"long", out: true|false } }  when the green was missed

export const CLUBS = ["Driver", "3 wood", "5 wood", "Hybrid", "4 iron", "5 iron", "6 iron", "7 iron", "8 iron", "9 iron", "PW", "GW", "SW", "LW"];
const has = v => v !== "" && v != null && !isNaN(+v);
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);

export function newHole(n, par = 4) {
  return { n, par, score: null, putts: null, fp: "", pen: 0, penFrom: "", rec: false, tee: { res: "", start: "", club: "Driver" }, app: { res: [], club: "", yds: "" }, sg: { kind: "chip", shots: 1, land: "", out: null } };
}

const played = holes => holes.filter(h => has(h.score));
const girOf = h => has(h.putts) ? h.score - h.putts <= h.par - 2 : (h.app?.res || []).includes("G");

export function totals(holesIn) {
  const holes = played(holesIn);
  const sum = k => holes.reduce((a, h) => a + (has(h[k]) ? +h[k] : 0), 0);
  const drives = holes.filter(h => h.par >= 4 && h.tee?.res);
  const fw = drives.filter(h => h.tee.res === "fw").length;
  const gir = holes.filter(girOf).length;
  const udCh = holes.filter(h => !girOf(h) && !(h.app?.res || []).includes("G"));
  const udMade = udCh.filter(h => has(h.putts) && +h.putts <= 1 && h.score - h.putts <= h.par - 1 && (!h.sg || (h.sg.shots || 1) <= 1)).length;
  return {
    holes: holes.length, score: sum("score"), par: holes.reduce((a, h) => a + h.par, 0),
    putts: holes.some(h => has(h.putts)) ? sum("putts") : "",
    fairways: drives.length ? `${fw}/${drives.length}` : "",
    gir, updown: udCh.length ? `${udMade}/${udCh.length}` : "",
    penalties: sum("pen"), threeputts: holes.filter(h => +h.putts >= 3).length,
    doubles: holes.filter(h => h.score - h.par >= 2).length
  };
}

// Miss patterns, as plain facts the coach, the student and the AI can read.
export function patterns(holesIn) {
  const holes = played(holesIn);
  const out = {};
  // Tee shots on par 4s and 5s
  const tee = holes.filter(h => h.par >= 4 && h.tee?.res);
  if (tee.length) {
    const miss = d => tee.filter(h => h.tee.res === d);
    const split = a => ({ total: a.length, curved: a.filter(h => h.tee.start === "curve").length, startedOff: a.filter(h => h.tee.start === "off").length });
    out.tee = { shots: tee.length, fairways: tee.filter(h => h.tee.res === "fw").length, left: split(miss("L")), right: split(miss("R")),
      clubs: [...new Set(tee.map(h => h.tee.club).filter(Boolean))] };
  }
  // Shots into the green
  const app = holes.filter(h => (h.app?.res || []).length);
  if (app.length) {
    const dir = d => app.filter(h => h.app.res.includes(d));
    const band = (lo, hi) => { const a = app.filter(h => has(h.app.yds) && +h.app.yds >= lo && +h.app.yds < hi); return { shots: a.length, greens: a.filter(h => h.app.res.includes("G")).length }; };
    out.approach = {
      shots: app.length, greens: dir("G").length, short: dir("S").length, long: dir("Lg").length, left: dir("L").length, right: dir("R").length,
      under100: band(0, 100), from100to150: band(100, 150), over150: band(150, 999),
      misses: app.filter(h => !h.app.res.includes("G")).map(h => `${h.app.res.map(r => ({ S: "short", Lg: "long", L: "left", R: "right" }[r])).join("-")}${h.app.club ? " with " + h.app.club : ""}${has(h.app.yds) ? " from " + h.app.yds + " yds" : ""}`)
    };
  }
  // Around the green
  const sg = holes.filter(h => !girOf(h) && h.sg && (h.sg.land || h.sg.out != null));
  if (sg.length) {
    const chips = sg.filter(h => h.sg.kind === "chip"), bunk = sg.filter(h => h.sg.kind === "bunker");
    out.shortGame = { chips: chips.length, onSpot: chips.filter(h => h.sg.land === "on").length, landedShort: chips.filter(h => h.sg.land === "short").length, landedLong: chips.filter(h => h.sg.land === "long").length,
      bunkers: bunk.length, bunkerOutInOne: bunk.filter(h => h.sg.out === true).length };
  }
  // Putting
  const pt = holes.filter(h => has(h.putts));
  if (pt.length) {
    const fp = pt.filter(h => has(h.fp));
    const inside = (lo, hi) => { const a = fp.filter(h => +h.fp >= lo && +h.fp < hi); return { tries: a.length, oneputts: a.filter(h => +h.putts <= 1).length, threeputts: a.filter(h => +h.putts >= 3).length }; };
    out.putting = { holes: pt.length, total: pt.reduce((a, h) => a + +h.putts, 0), threeputts: pt.filter(h => +h.putts >= 3).length, oneputts: pt.filter(h => +h.putts === 1).length,
      avgFirstPuttFt: fp.length ? Math.round(fp.reduce((a, h) => a + +h.fp, 0) / fp.length) : null,
      under6ft: inside(0, 6), from6to20ft: inside(6, 20), over20ft: inside(20, 999) };
  }
  // Penalties and recovery shots
  const pen = holes.filter(h => +h.pen > 0);
  const rec = holes.filter(h => h.rec).length;
  if (pen.length || rec) out.trouble = { penalties: pen.reduce((a, h) => a + +h.pen, 0), fromTee: pen.filter(h => h.penFrom === "tee").reduce((a, h) => a + +h.pen, 0), fromApproach: pen.filter(h => h.penFrom === "app").reduce((a, h) => a + +h.pen, 0), recoveryShots: rec };
  // Scoring by par
  const byPar = p => { const a = holes.filter(h => h.par === p); return a.length ? +(a.reduce((s, h) => s + h.score - h.par, 0) / a.length).toFixed(2) : null; };
  out.scoring = { par3: byPar(3), par4: byPar(4), par5: byPar(5), doubles: holes.filter(h => h.score - h.par >= 2).map(h => h.n) };
  return out;
}

// Readable lines for the app (student and coach).
export function patternLines(p) {
  const L = [];
  if (p.tee) {
    const t = p.tee, m = (d, x) => x.total ? `${x.total} ${d}${x.curved || x.startedOff ? ` (${[x.curved && `${x.curved} started on line and curved`, x.startedOff && `${x.startedOff} started ${d}`].filter(Boolean).join(", ")})` : ""}` : "";
    L.push(["Tee shots", `${t.fairways} of ${t.shots} fairways. Misses: ${[m("left", t.left), m("right", t.right)].filter(Boolean).join("; ") || "none"}.`]);
  }
  if (p.approach) {
    const a = p.approach;
    const dirs = [["short", a.short], ["long", a.long], ["left", a.left], ["right", a.right]].filter(([, n]) => n).sort((x, y) => y[1] - x[1]).map(([d, n]) => `${n} ${d}`);
    const bands = [["under 100", a.under100], ["100–150", a.from100to150], ["150+", a.over150]].filter(([, b]) => b.shots).map(([l, b]) => `${l} yds ${b.greens}/${b.shots}`);
    L.push(["Into the green", `${a.greens} of ${a.shots} shots into the green finished on it${dirs.length ? `. Misses: ${dirs.join(", ")}` : ""}${bands.length ? `. By distance: ${bands.join(", ")}` : ""}.`]);
  }
  if (p.shortGame) {
    const s = p.shortGame;
    L.push(["Around the green", [s.chips && `${s.onSpot} of ${s.chips} chips landed on the spot${s.landedShort ? `, ${s.landedShort} short` : ""}${s.landedLong ? `, ${s.landedLong} long` : ""}`, s.bunkers && `${s.bunkerOutInOne} of ${s.bunkers} bunker shots out in one`].filter(Boolean).join(". ") + "."]);
  }
  if (p.putting) {
    const u = p.putting, r = (l, b) => b.tries ? `${l}: ${b.oneputts}/${b.tries} one-putts${b.threeputts ? `, ${b.threeputts} three-putt${b.threeputts === 1 ? "" : "s"}` : ""}` : "";
    L.push(["Putting", `${u.total} putts, ${u.threeputts} three-putt${u.threeputts === 1 ? "" : "s"}${u.avgFirstPuttFt != null ? `, first putts averaged ${u.avgFirstPuttFt} ft` : ""}. ${[r("Under 6 ft", u.under6ft), r("6–20 ft", u.from6to20ft), r("20+ ft", u.over20ft)].filter(Boolean).join("; ")}`.trim()]);
  }
  if (p.trouble) {
    const t = p.trouble;
    L.push(["Trouble", `${t.penalties} penalty stroke${t.penalties === 1 ? "" : "s"}${t.fromTee ? ` (${t.fromTee} off the tee)` : ""}${t.fromApproach ? ` (${t.fromApproach} on approaches)` : ""}${t.recoveryShots ? `, ${t.recoveryShots} recovery shot${t.recoveryShots > 1 ? "s" : ""}` : ""}.`]);
  }
  if (p.scoring) {
    const s = p.scoring, f = v => v == null ? null : (v > 0 ? "+" : "") + v.toFixed(1);
    const parts = [["Par 3s", f(s.par3)], ["Par 4s", f(s.par4)], ["Par 5s", f(s.par5)]].filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`);
    if (parts.length) L.push(["Scoring", `Average per hole vs par: ${parts.join(", ")}${s.doubles.length ? `. Doubles or worse on hole${s.doubles.length > 1 ? "s" : ""} ${s.doubles.join(", ")}` : ""}.`]);
  }
  return L;
}
