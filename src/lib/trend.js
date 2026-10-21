// Round trend chart (last 5 or 10 rounds), filterable by round type, used by students and the coach.
import { esc, shortDate } from "./util.js";

export const TREND_TYPES = [["all", "All"], ["Tournament", "Tournament"], ["practice", "Practice & casual"]];
export const TREND_METRICS = [["score", "Score"], ["putts", "Putts"], ["gir", "Greens"]];

const num = v => (v === "" || v == null || isNaN(+v) ? null : +v);
const isType = (r, t) => t === "all" || (t === "Tournament" ? r.event === "Tournament" : r.event !== "Tournament");

export function trendRounds(rounds, { type = "all", n = 5, holes = "18", metric = "score" }) {
  return rounds
    .filter(r => String(r.holes || "18") === holes && isType(r, type) && num(r[metric]) != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.created_at).localeCompare(String(b.created_at)))
    .slice(-n);
}

export function trendHtml(rounds, opt) {
  const { metric = "score", n = 5, type = "all", holes = "18" } = opt;
  const pts = trendRounds(rounds, opt);
  const label = { score: "Score", putts: "Putts", gir: "Greens hit" }[metric];
  const lowerBetter = metric !== "gir";
  const has9 = rounds.some(r => String(r.holes) === "9"), has18 = rounds.some(r => String(r.holes || "18") === "18");
  const chip = (attr, list, cur) => `<div class="pick tr-pick">${list.map(([v, l]) => `<button type="button" class="pick-btn sm" data-${attr}="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
  const controls = `<div class="tr-controls">${chip("trtype", TREND_TYPES, type)}
    <div class="tr-row">${chip("trn", [[5, "Last 5"], [10, "Last 10"]], n)}${has9 && has18 ? chip("trholes", [["18", "18 holes"], ["9", "9 holes"]], holes) : ""}</div>
    ${chip("trmetric", TREND_METRICS, metric)}</div>`;
  if (pts.length < 2) {
    return controls + `<p class="muted tr-empty">${pts.length ? "One round so far" : "No rounds"} for this choice. Log ${pts.length ? "one more" : "two or more"} ${type === "Tournament" ? "tournament " : type === "practice" ? "practice or casual " : ""}${holes}-hole ${pts.length ? "round" : "rounds"}${metric !== "score" ? ` with ${label.toLowerCase()}` : ""} to see the trend.</p>`;
  }
  const ys = pts.map(p => +p[metric]);
  const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
  const best = lowerBetter ? Math.min(...ys) : Math.max(...ys);
  // Trend: average of the newer half vs the older half.
  const h = Math.floor(ys.length / 2), older = ys.slice(0, h), newer = ys.slice(-h);
  const delta = newer.reduce((a, b) => a + b, 0) / newer.length - older.reduce((a, b) => a + b, 0) / older.length;
  const better = lowerBetter ? delta < -0.25 : delta > 0.25, worse = lowerBetter ? delta > 0.25 : delta < -0.25;
  const W = 340, H = 180, L = 30, R = 12, T = 22, B = 30;
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(2, Math.round((hi - lo) * 0.2)); lo = Math.floor(lo - pad); hi = Math.ceil(hi + pad);
  const x = i => L + 14 + (pts.length === 1 ? 0 : i * (W - L - R - 28) / (pts.length - 1));
  // Lower-is-better metrics are drawn with better results higher up.
  const y = v => lowerBetter ? T + (v - lo) * (H - T - B) / (hi - lo) : T + (hi - v) * (H - T - B) / (hi - lo);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(+p[metric]).toFixed(1)}`).join(" ");
  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const f1 = v => (Math.round(v * 10) / 10).toString();
  return controls + `
    <div class="tr-sum"><div><b>${f1(avg)}</b><small>Average</small></div><div><b>${best}</b><small>Best</small></div>
      <div class="${better ? "up" : worse ? "down" : ""}"><b>${better ? "▲" : worse ? "▼" : "–"} ${f1(Math.abs(delta))}</b><small>${better ? "Improving" : worse ? "Slipping" : "Steady"}</small></div></div>
    <svg class="tr-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} over the last ${pts.length} rounds">
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="tr-grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="tr-ax">${v}</text>`).join("")}
      <line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" class="tr-avg"/>
      <polyline points="${line}" class="tr-line"/>
      ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(+p[metric])}" r="${i === pts.length - 1 ? 5 : 3.5}" class="tr-dot ${p.event === "Tournament" ? "t" : ""} ${i === pts.length - 1 ? "last" : ""}"/>
        <text x="${x(i)}" y="${y(+p[metric]) - 9}" text-anchor="middle" class="tr-val">${esc(p[metric])}</text>
        ${pts.length <= 6 || i % 2 === (pts.length - 1) % 2 ? `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="tr-ax">${esc(shortDate(p.date))}</text>` : ""}`).join("")}
    </svg>
    <p class="tr-key"><span class="k-line"></span>${esc(label)} <span class="k-avg"></span>Average${type === "all" ? ` <span class="k-t"></span>Tournament` : ""}<span style="margin-left:auto">${lowerBetter ? "Better is higher on the chart" : "Higher is better"}</span></p>` + glanceHtml(rounds, opt);
}

// Small side-by-side charts (Score, Putts, Greens) for the same filters: the metric is bold, the other two are faded.
function glanceHtml(rounds, { type = "all", n = 5, holes = "18" }) {
  const W = 100, H = 56, L = 8, R = 8, T = 8, B = 8;
  const series = TREND_METRICS.map(([m, label]) => {
    const ys = trendRounds(rounds, { type, n, holes, metric: m }).map(p => +p[m]);
    if (ys.length < 2) return { m, label, pts: null };
    const lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
    // Better is always up: lower is better for score and putts, higher for greens.
    const pts = ys.map((v, i) => {
      const up = m === "gir" ? (v - lo) / span : (hi - v) / span;
      return `${(L + i * (W - L - R) / (ys.length - 1)).toFixed(1)},${(H - B - up * (H - T - B)).toFixed(1)}`;
    });
    return { m, label, pts };
  });
  const shown = series.filter(s => s.pts);
  if (shown.length < 2) return "";
  return `<div class="tr-glance" aria-label="All stats at a glance">${shown.map(s => `<div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.label)} trend, same rounds">
        ${shown.filter(o => o !== s).map(o => `<polyline points="${o.pts.join(" ")}" class="tg-faded"/>`).join("")}
        <polyline points="${s.pts.join(" ")}" class="tg-main"/>
        <circle cx="${s.pts[s.pts.length - 1].split(",")[0]}" cy="${s.pts[s.pts.length - 1].split(",")[1]}" r="4" class="tg-end"/>
      </svg><small>${esc(s.label)}</small></div>`).join("")}</div>`;
}
