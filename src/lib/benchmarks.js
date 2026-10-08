// What it takes to shoot a score: average stats of amateur golfers at each scoring level.
// Source: Break X Golf analysis of 3,788 rounds from 1,116 golfers (breakxgolf.com/golf-stats-by-handicap).
const ROWS = [
  // score, fairways %, greens in regulation %, putts, up-and-down %
  [74.6, 56.5, 56.8, 31.3, 50.0],
  [79.0, 51.0, 46.1, 32.5, 37.7],
  [84.6, 49.3, 37.3, 33.9, 31.6],
  [89.3, 48.1, 26.4, 34.8, 25.1],
  [93.7, 42.8, 22.4, 36.1, 21.7],
  [98.6, 43.0, 18.7, 37.0, 20.3]
];
export const BENCH_SOURCE = "Averages from 3,788 amateur rounds (Break X Golf).";

// Interpolates the benchmark for a target 18-hole score.
export function benchmark(score) {
  const s = Math.max(ROWS[0][0], Math.min(ROWS[ROWS.length - 1][0], +score));
  let i = 0;
  while (i < ROWS.length - 2 && s > ROWS[i + 1][0]) i++;
  const [a, b] = [ROWS[i], ROWS[i + 1]];
  const t = (s - a[0]) / (b[0] - a[0]);
  const lerp = k => a[k] + (b[k] - a[k]) * t;
  return {
    fairways: lerp(1) / 100 * 14, // of 14 driving holes
    gir: lerp(2) / 100 * 18,
    putts: lerp(3),
    updown: lerp(4)
  };
}

// The student's own averages from their last few 18-hole rounds.
export function myAverages(rounds, n = 5) {
  const r = rounds.filter(x => String(x.holes || "18") === "18" && x.score !== "" && x.score != null && !isNaN(+x.score))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, n);
  if (!r.length) return null;
  const avg = f => { const v = r.map(f).filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const fw = x => { const m = String(x.fairways || "").match(/(\d+)\s*\/\s*(\d+)/); return m ? +m[1] / +m[2] * 14 : (x.fairways !== "" && !isNaN(+x.fairways) ? +x.fairways : null); };
  const ud = x => { const m = String(x.updown || "").match(/(\d+)\s*\/\s*(\d+)/); return m && +m[2] ? +m[1] / +m[2] * 100 : null; };
  const num = k => x => (x[k] === "" || x[k] == null || isNaN(+x[k]) ? null : +x[k]);
  return { rounds: r.length, score: avg(num("score")), fairways: avg(fw), gir: avg(num("gir")), putts: avg(num("putts")), updown: avg(ud) };
}

const f1 = v => (v == null ? "–" : (Math.round(v * 10) / 10).toString());

// The stat where the student is furthest behind golfers who shoot the target score.
// Scaled so stats compare: a green ≈ a stroke, a putt = a stroke, a fairway ≈ ⅓ stroke, 10% up & down ≈ 1 stroke.
export function biggestGap(target, mine) {
  if (!mine) return null;
  const b = benchmark(target);
  const rows = [["Greens in regulation", b.gir, mine.gir, 1, 1], ["Fairways hit", b.fairways, mine.fairways, 1, 0.35], ["Putts", b.putts, mine.putts, -1, 1], ["Up & down", b.updown, mine.updown, 1, 0.1]];
  let best = null;
  rows.forEach(([name, t, m, dir, w]) => {
    if (m == null) return;
    const gap = (dir > 0 ? t - m : m - t) * w;
    if (gap > 0.25 && (!best || gap > best.gap)) best = { name, gap, t, m };
  });
  return best;
}

// A small table: target vs the student's own averages, with the biggest gap called out.
export function benchmarkTable(target, mine, esc) {
  const b = benchmark(target);
  const rows = [
    ["Greens in regulation", b.gir, mine?.gir, "per round", 1],
    ["Fairways hit", b.fairways, mine?.fairways, "of 14", 1],
    ["Putts", b.putts, mine?.putts, "per round", -1],
    ["Up & down", b.updown, mine?.updown, "%", 1]
  ];
  const best = biggestGap(target, mine);
  return `<div class="bench">
    <table><thead><tr><th>To shoot ${esc(Math.round(target))}</th><th class="n">Typical</th><th class="n">You</th></tr></thead>
    <tbody>${rows.map(([name, t, m, unit]) => `<tr><td>${name} <small>${unit}</small></td><td class="n"><b>${f1(t)}</b></td><td class="n">${f1(m)}</td></tr>`).join("")}</tbody></table>
    ${mine ? (best ? `<p class="bench-tip"><b>Biggest opportunity: ${esc(best.name.toLowerCase())}.</b> You average ${f1(best.m)}; golfers who shoot ${Math.round(target)} average ${f1(best.t)}.</p>` : `<p class="bench-tip"><b>Your stats already match this score.</b> Time to aim lower.</p>`)
      : `<p class="bench-tip">Log rounds with putts, fairways and greens to compare yourself.</p>`}
    <p class="bench-src">${esc(BENCH_SOURCE)} ${mine ? `"You" = your last ${mine.rounds} 18-hole round${mine.rounds > 1 ? "s" : ""}.` : ""}</p>
  </div>`;
}
