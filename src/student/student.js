import "./student.css";
import { api } from "../lib/store.js";
import { videoThumb, videoField, bindPlayer } from "../lib/video.js";
import { quoteOfTheDay } from "../lib/quotes.js";
import { benchmarkTable, myAverages, biggestGap, benchmark } from "../lib/benchmarks.js";
import { trendHtml } from "../lib/trend.js";
import { newBag, estimateFrom7, mergeInto, sortBag, carried, gapNotes, clubsFor } from "../lib/bag.js";
import { CLUBS, newHole, totals, patterns, patternLines } from "../lib/roundstats.js";
import { PLACES, GAMES, WEEKS, WEEK_TIPS, levelOf, buildSession, focusFor, drillGames } from "../lib/scenarios.js";
import { GOAL_PERIODS, GOAL_FIELDS, GOAL_GUIDE } from "../lib/goals.js";
import { logo, DAYS, AREA_NAMES, esc, initials, today, todayIndex, dateParts, fmtDate, shortDate, safeUrl, areaChip, focusBar, toast, friendly, draft, addDays, weekStartOf, weekDates, weekLabel, dayName, dayNum, blockDate } from "../lib/util.js";

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  rounds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21V3l10 4-10 4"/><ellipse cx="12" cy="21" rx="7" ry="1.2"/></svg>',
  lessons: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/></svg>',
  goals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>'
};
const PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
const RATINGS = ["Rough", "Meh", "OK", "Good", "Great"];
const LOCK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';

export function start(root, { students, onSignOut }) {
  const S = {
    students, sid: null, profile: null, entries: [], scores: [],
    screen: "home", sheet: null, logOpen: false, loading: true,
    practiceOpen: false, sess: { areas: [], rating: 0 }, goalDraft: {}, calc: null,
    trend: { type: "all", n: 5, holes: "18", metric: "score" },
    game: { place: "range", minutes: 30, focus: "auto", seed: 0, ai: null, aiBusy: false, pin: null, week: "normal", tdate: "" }, aiAvailable: null, reviews: {}
  };
  try { const saved = localStorage.getItem("sph.student"); if (students.some(s => s.id === saved)) S.sid = saved; } catch {}
  if (!S.sid) S.sid = students[0].id;

  let stopWatch = null, reloadTimer = null;

  // ---------- data
  async function load() {
    const sid = S.sid;
    try {
      const [profile, entries, scores] = await Promise.all([api.studentProfile(sid), api.entries(sid), api.scores(sid)]);
      if (sid !== S.sid) return; // the player was switched while this was loading
      S.profile = profile; S.entries = entries; S.scores = scores; S.loading = false;
      render();
    } catch (err) { if (sid !== S.sid) return; S.loading = false; render(); toast(friendly(err)); }
  }
  // Live updates wait while the student is typing, so the keyboard doesn't close mid-word.
  let pendingReload = false;
  const typing = () => { const a = document.activeElement; return !!a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== "checkbox" && a.type !== "file"; };
  function liveReload() { clearTimeout(reloadTimer); reloadTimer = setTimeout(() => { if (typing()) { pendingReload = true; return; } load(); }, 400); }
  root.addEventListener("focusout", () => setTimeout(() => { if (pendingReload && !typing()) { pendingReload = false; load(); } }, 50));
  function select(id) {
    S.sid = id; S.loading = true; S.sheet = null; S.screen = "home"; S.goalDraft = {}; S.calc = null; S.practiceOpen = false; S.live = draft.get(`${id}.live`); S.liveSetup = null;
    S.profile = null; S.entries = []; S.scores = []; S.bagDraft = null; S.planWeek = null; S.reviews = {}; S.bagBusy = false;
    S.game = { ...S.game, ai: null, aiBusy: false, pin: null, seed: 0 };
    { const w = draft.get(`${id}.week`); S.game.week = w && w.until >= today() ? w.week : "normal"; S.game.tdate = w && w.until >= today() ? w.tdate || "" : ""; }
    try { localStorage.setItem("sph.student", id); } catch {}
    if (stopWatch) stopWatch();
    stopWatch = api.watch([id], liveReload);
    render(); load();
  }

  const of = t => S.entries.filter(e => e.type === t);
  const drillById = id => S.entries.find(e => e.id === id && e.type === "drill");
  const scoresFor = id => S.scores.filter(s => s.drill_id === id).sort((a, b) => (a.scored_on + a.created_at).localeCompare(b.scored_on + b.created_at));
  const lastScore = id => { const a = scoresFor(id); return a[a.length - 1] || null; };
  // Practice blocks for one calendar week (Monday start), in date order.
  const plan = (ws = weekStartOf()) => of("plan").filter(x => weekStartOf(blockDate(x)) === ws).sort((a, b) => blockDate(a).localeCompare(blockDate(b)));
  const mins = (ws = weekStartOf()) => {
    const p = plan(ws);
    const planned = p.reduce((a, x) => a + (+x.minutes || 0), 0);
    const done = p.filter(x => x.done).reduce((a, x) => a + (+x.minutes || 0), 0);
    return { planned, done, pct: planned ? Math.round(done / planned * 100) : 0 };
  };
  const byDateDesc = a => a.slice().sort((x, y) => String(y.date || y.created_at).localeCompare(String(x.date || x.created_at)));
  const goal = () => of("goal")[0] || null;
  const bagEntry = () => of("bag")[0] || null;
  const myBag = () => bagEntry()?.clubs || [];
  const sessions = () => byDateDesc(of("session"));
  const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - todayIndex()); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const targetScore = () => {
    const m = String(goal()?.m3?.score || "").match(/\b(6\d|7\d|8\d|9\d|1[01]\d)\b/);
    const mine = myAverages(of("stat"));
    return m ? +m[1] : mine?.score ? Math.max(70, Math.round(mine.score) - 3) : 90;
  };
  const autoFocus = () => {
    const gap = biggestGap(targetScore(), myAverages(of("stat")));
    const g = goal() || {};
    return focusFor({ gapName: gap?.name, goalsText: [S.profile?.goals, ...["m3", "m6"].flatMap(k => Object.values(g[k] || {}))].join(" ") });
  };
  const daysOut = () => { const t = S.game.tdate; if (!t) return null; return Math.round((new Date(t + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5); };
  const saveWeek = () => {
    // Remembered for 7 days (or until the tournament).
    const d = new Date(); d.setDate(d.getDate() + 7);
    const until = S.game.week === "tournament" && S.game.tdate ? S.game.tdate : d.toISOString().slice(0, 10);
    if (S.game.week === "normal") draft.clear(`${S.sid}.week`); else draft.set(`${S.sid}.week`, { week: S.game.week, tdate: S.game.tdate, until });
  };
  const currentSession = () => {
    const G = S.game, auto = G.focus === "auto" ? autoFocus() : null;
    const focus = G.focus === "auto" ? auto?.key : G.focus;
    const pin = G.pin && GAMES.find(x => x.id === G.pin && x.place === G.place);
    const built = buildSession({ place: G.place, minutes: G.minutes - (pin ? pin.min : 0), level: levelOf(S.profile?.handicap), focus, seed: G.seed, exclude: pin ? [pin.id] : [],
      week: G.week, daysOut: daysOut(), extra: G.week === "swing" ? drillGames(of("drill")) : [] });
    const games = pin ? [pin, ...(G.place === "course" ? [] : built.filter(x => x.min <= G.minutes - pin.min))].slice(0, 3) : built;
    return { games, focus, why: pin ? "Picked from your round review." : auto?.why || "" };
  };
  const firstName = () => String(S.profile?.name || "").split(/\s+/)[0];

  // ---------- pieces
  function top(title, sub) {
    return `<header class="s-top">${logo("s-logo")}<div style="flex:1;min-width:0"><div class="hello">${esc(sub)}</div><h1>${esc(title)}</h1></div>
      <button class="av" data-act="menu" aria-label="Account and settings">${esc(initials(S.profile?.name))}</button></header>`;
  }
  function task(p) {
    const dr = p.drill && drillById(p.drill);
    const ls = dr && lastScore(dr.id);
    return `<div class="task ${p.done ? "done" : ""}">
      <input type="checkbox" id="task-${esc(p.id)}" data-task="${esc(p.id)}" ${p.done ? "checked" : ""} aria-label="Mark ${esc(p.title)} done">
      <button class="open" data-open="${esc(p.id)}">${areaChip(p.area)}<span class="t">${esc(p.title)}</span>${p.details ? `<span class="d">${esc(p.details)}</span>` : ""}
      ${dr && dr.goal ? `<span class="score">${ls ? `Last: ${ls.score}/${ls.out_of} · ` : ""}Target ${esc(dr.goal)}/${esc(dr.of || 10)}</span>` : ""}</button>
      <span class="side">${p.minutes ? `<span class="m">${esc(p.minutes)}m</span>` : ""}<span class="chev" aria-hidden="true">›</span></span></div>`;
  }
  function hist(dr) {
    const sc = scoresFor(dr.id).slice(-6);
    if (!sc.length) return `<p class="muted">No scores yet. Your first one sets the baseline.</p>`;
    const H = 60, max = +dr.of || Math.max(...sc.map(s => s.out_of)), t = (+dr.goal || 0) / max * H;
    return `<div class="hist" aria-label="Your recent scores">${sc.map((x, i) => `<div class="col ${i === sc.length - 1 ? "last" : ""}"><b>${x.score}</b><div class="zone"><i style="height:${Math.max(3, x.score / max * H)}px"></i>${dr.goal ? `<span class="tl" style="bottom:${t}px"></span>` : ""}</div>${esc(shortDate(x.scored_on))}</div>`).join("")}</div>
      ${dr.goal ? `<div class="hist-key"><span></span>Target ${esc(dr.goal)}/${esc(dr.of || 10)}</div>` : ""}`;
  }
  function demoLink(u, label) {
    const s = safeUrl(u);
    return s ? `<a class="demo" href="${esc(s)}" target="_blank" rel="noopener"><span class="play">${PLAY}</span><span><b>${esc(label)}</b><small>Opens in a new tab</small></span></a>` : "";
  }

  // ---------- screens
  function home() {
    const m = mins(), p = plan(), td = today();
    const todays = p.filter(x => blockDate(x) === td);
    const lesson = byDateDesc(of("lesson")).find(l => l.homework);
    const rounds = of("stat").filter(r => String(r.holes || "18") === "18" && r.score !== "" && r.score != null);
    const recent = byDateDesc(rounds).slice(0, 3);
    const avg = recent.length ? (recent.reduce((a, r) => a + +r.score, 0) / recent.length).toFixed(1) : null;
    const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    return top(`Hi, ${firstName()}`, dateLine) + `<main class="s-content">
      <section class="thought"><span>Today's thought</span><p>${esc(quoteOfTheDay())}</p></section>
      <section class="card week-card"><h2>This week's practice <span>${esc(weekLabel(weekStartOf()))}</span></h2>
        <div class="big-n">${m.done}<small> / ${m.planned} min</small></div>
        <div class="bar"><i style="width:${m.pct}%"></i></div>
        <div class="dots">${weekDates(weekStartOf()).map(dt => { const b = p.filter(x => blockDate(x) === dt); const on = b.length && b.every(x => x.done); return `<div class="${on ? "on" : ""} ${dt === td ? "today" : ""} ${b.length ? "" : "rest"}"><b>${on ? "✓" : dayNum(dt)}</b>${dayName(dt)}</div>`; }).join("")}</div>
      </section>
      <section class="card"><h2>Today <span>${todays.reduce((a, x) => a + (+x.minutes || 0), 0) || ""}${todays.length ? " min" : ""}</span></h2>
        ${todays.map(task).join("") || `<p class="muted">Nothing planned today. Rest, or get ahead on tomorrow.</p>`}</section>
      ${lesson ? `<section class="card"><h2>Homework from Karina</h2><div class="hw">${esc(lesson.homework)}<div class="from">From your ${esc(shortDate(lesson.date))} lesson${lesson.focus ? " · " + esc(lesson.focus) : ""}</div></div></section>` : ""}
      <section class="card"><h2>Your season</h2>
        ${S.profile?.next_lesson || avg ? `<div class="goal-row">${S.profile?.next_lesson ? `<div><div class="l">Next lesson</div><div class="v">${esc(fmtDate(S.profile.next_lesson).replace(/, \d{4}$/, ""))}</div></div>` : "<div></div>"}${avg ? `<div style="text-align:right"><div class="l">Avg of last ${recent.length}</div><div class="v">${avg}</div></div>` : ""}</div>` : ""}
        ${S.profile?.goals ? `<p style="margin:0;font-size:14px;white-space:pre-wrap"><b>Karina's focus:</b> ${esc(S.profile.goals)}</p>` : ""}
        ${(() => { const g = goal()?.m3 || {}; const lines = [["Score goal", g.score], ["Practice habit", g.process]].filter(([, v]) => v);
          return lines.length ? `<button class="goal-peek" data-go="goals">${lines.map(([k, v]) => `<span><b>${k}:</b> ${esc(v)}</span>`).join("")}<small>Your 3-month goals ›</small></button>`
            : `<button class="btn" data-go="goals">Set your goals</button>`; })()}
      </section>
      <button class="btn primary" data-go="games">Get a practice game</button>
      <button class="btn" data-act="practice">Log today's practice</button>
      <div class="row2"><button class="btn" data-act="log">Log a round</button><button class="btn" data-go="notes">Send Karina a swing</button></div>
    </main>`;
  }
  function planScreen() {
    const ws = S.planWeek || weekStartOf(), cur = ws === weekStartOf(), td = today();
    const m = mins(ws), p = plan(ws);
    const rel = cur ? "This week" : ws === addDays(weekStartOf(), 7) ? "Next week" : ws === addDays(weekStartOf(), -7) ? "Last week" : "";
    const weekNav = `<div class="week-nav"><button class="btn" data-pweek="-7" aria-label="Previous week">‹</button><div><b>${esc(weekLabel(ws))}</b>${rel ? `<small>${rel}</small>` : ""}</div><button class="btn" data-pweek="7" aria-label="Next week">›</button></div>`;
    const planPart = weekNav + (!p.length ? `<div class="card"><p class="muted">${cur ? "Karina hasn't set this week's plan yet. You can still log what you practice below." : "No plan for this week."}</p></div>` : `
      <section class="card"><h2>Progress <span>${m.done} of ${m.planned} min · ${m.pct}%</span></h2><div class="bar plain"><i style="width:${m.pct}%"></i></div></section>
      <section class="card"><h2>What you're working on</h2>${focusBar(p, x => x.minutes, x => x.area)}</section>
      ${weekDates(ws).map(dt => { const b = p.filter(x => blockDate(x) === dt); if (!b.length) return ""; return `<section class="card ${dt === td ? "is-today" : ""}"><h2>${dayName(dt)}, ${esc(shortDate(dt))}${dt === td ? " · today" : ""} <span>${b.reduce((a, x) => a + (+x.minutes || 0), 0)} min</span></h2>${b.map(task).join("")}</section>`; }).join("")}
      <p class="muted" style="text-align:center">Karina sets your plan. Days not shown are rest days.</p>`);
    return top("Practice plan", S.profile?.name || "") + `<main class="s-content">
      <button class="games-cta" data-go="games"><b>Practice games</b><span>Range, short game, putting and on-course games picked for your game. Tap to get a session.</span></button>
      ${planPart}${practiceLog()}</main>`;
  }
  function practiceLog() {
    const all = sessions(), ws = weekStart();
    const wk = all.filter(x => String(x.date) >= ws);
    const wmin = wk.reduce((a, x) => a + (+x.minutes || 0), 0);
    return `<section class="card" id="practice-log"><h2>Practice log <span>${wk.length ? `This week: ${wk.length} session${wk.length > 1 ? "s" : ""} · ${wmin} min` : ""}</span></h2>
      <p class="muted">After every practice, write down what you worked on and how it went. It's the fastest way to see what's working, and Karina reads every one.</p>
      ${S.practiceOpen ? practiceForm() : `<button class="btn primary" data-act="practice">+ Log a practice</button>`}
      ${all.slice(0, 12).map(sessionRow).join("") || (S.practiceOpen ? "" : `<p class="muted">No practice logged yet.</p>`)}
      ${all.length > 12 ? `<p class="muted">Showing your last 12 sessions.</p>` : ""}</section>`;
  }
  function sessionRow(x) {
    const d = dateParts(x.date);
    return `<button class="round sess" data-sess="${esc(x.id)}"><span class="date"><b>${d.d}</b><small>${esc(d.mon || "")}</small></span>
      <span style="min-width:0"><span class="sess-areas">${(Array.isArray(x.areas) ? x.areas : []).map(areaChip).join("")}</span><span class="meta clamp">${esc(x.worked || x.went || "Practice")}</span></span>
      <span class="sess-side">${x.minutes ? `<b>${esc(x.minutes)}</b><small>min</small>` : ""}${x.rating ? `<span class="rate r${+x.rating}">${RATINGS[+x.rating - 1]}</span>` : ""}</span></button>`;
  }
  function practiceForm() {
    const ws = S.sess;
    return `<form id="practiceForm" class="pform" novalidate>
      <div class="row2"><div class="field"><label for="p-date">Date</label><input id="p-date" type="date" value="${today()}"></div>
      <div class="field"><label for="p-min">Minutes</label><input id="p-min" inputmode="numeric" placeholder="e.g. 45"></div></div>
      <fieldset class="field"><legend>What did you work on?</legend><div class="pick">${AREA_NAMES.map(a => `<button type="button" class="pick-btn" data-area="${esc(a)}" aria-pressed="${ws.areas.includes(a)}">${esc(a)}</button>`).join("")}</div></fieldset>
      <div class="field"><label for="p-worked">What did you practice?</label><textarea id="p-worked" placeholder="e.g. Putting ladder 3 times, 30 balls with the chair drill, 10 bunker shots"></textarea></div>
      <fieldset class="field"><legend>How did it go?</legend><div class="pick rate-pick">${RATINGS.map((r, i) => `<button type="button" class="pick-btn" data-rate="${i + 1}" aria-pressed="${ws.rating === i + 1}">${r}</button>`).join("")}</div></fieldset>
      <div class="field"><label for="p-went">What went well, what didn't?</label><textarea id="p-went" placeholder="e.g. Made 7/10 from 6 ft, best yet. Lost focus on the long putts."></textarea></div>
      <div class="field"><label for="p-next">Next time I'll…</label><textarea id="p-next" placeholder="e.g. Start with long putts while I'm fresh"></textarea></div>
      <div class="row2"><button type="button" class="btn" data-act="cancel-practice">Cancel</button><button type="submit" class="btn primary">Save practice</button></div></form>`;
  }
  function gamesScreen() {
    const G = S.game, lvl = levelOf(S.profile?.handicap);
    const { games, why } = currentSession();
    const total = games.reduce((a, g) => a + g.min, 0);
    const FOCUS = [["auto", "Pick for me"], ["putts", "Putting"], ["gir", "Hitting greens"], ["fairways", "Fairways"], ["updown", "Up & downs"], ["mental", "Mental"]];
    const ai = G.ai && G.ai.key === sessionKey(games) ? G.ai : null;
    const tipFor = id => ai?.games?.find(x => x.id === id);
    const pick = (attr, list, cur) => `<div class="pick">${list.map(([v, l]) => `<button type="button" class="pick-btn" ${attr}="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
    return top("Practice games", S.profile?.name || "") + `<main class="s-content">
      <section class="card">
        <fieldset class="field"><legend>This week I'm…</legend>${pick("data-gweek", WEEKS, G.week)}
          ${G.week === "tournament" ? `<div class="lv-row"><label>Tournament day <input type="date" id="g-tdate" class="lv-num" style="width:auto" value="${esc(G.tdate)}"></label>${daysOut() != null && daysOut() >= 0 ? `<span class="pill n">${daysOut() === 0 ? "Today!" : daysOut() + " day" + (daysOut() > 1 ? "s" : "") + " to go"}</span>` : ""}</div>` : ""}</fieldset>
        ${WEEK_TIPS[G.week](daysOut()) ? `<p class="week-tip">${esc(WEEK_TIPS[G.week](daysOut()))}</p>` : ""}
        <fieldset class="field"><legend>Where are you practicing?</legend>${pick("data-gplace", PLACES, G.place)}</fieldset>
        <fieldset class="field"><legend>How much time do you have?</legend>${pick("data-gmin", (G.place === "course" ? [60, 90, 120] : [15, 30, 45, 60]).map(m => [m, m + " min"]), G.minutes)}</fieldset>
        ${G.week === "normal" ? `<fieldset class="field"><legend>What do you want to work on?</legend>${pick("data-gfocus", FOCUS, G.focus)}</fieldset>` : ""}
      </section>
      ${games.length ? `
      <section class="card session-head"><h2>Your session <span>${total} min · ${games.length} game${games.length > 1 ? "s" : ""}</span></h2>
        ${why && G.week === "normal" ? `<p class="why">${esc(why)}</p>` : ""}
        ${G.week === "swing" && games.some(g => g.drill) ? `<p class="why">Starts with your drill from Karina.</p>` : ""}
        ${ai?.intro ? `<p class="ai-intro"><b>Tailored for you:</b> ${esc(ai.intro)}</p>` : ""}
        <p class="muted">Warm up first: 5 minutes of easy swings or short putts before the first game.</p></section>
      ${games.map((g, i) => { const t = tipFor(g.id); return `<section class="card game">
        <div class="game-top"><span class="gnum">${i + 1}</span><div style="min-width:0"><h3>${esc(g.name)}</h3><div class="gmeta">${areaChip(g.area)}<span>${g.min} min</span></div></div></div>
        <p>${esc(g.setup)}</p>
        <ol>${g.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
        <div class="gscore"><div><b>Score</b><span>${esc(g.score)}</span></div><div><b>Your target</b><span>${esc(t?.target || g.pass[lvl])}</span></div></div>
        ${t?.tip ? `<p class="ai-tip"><b>For you:</b> ${esc(t.tip)}</p>` : ""}
        <p class="twist"><b>Make it harder:</b> ${esc(g.twist)}</p>
      </section>`; }).join("")}
      <div class="row2"><button class="btn" data-act="game-shuffle">Different games</button>${S.aiAvailable ? `<button class="btn" data-act="game-ai" ${G.aiBusy ? "disabled" : ""}>${G.aiBusy ? "Thinking…" : ai ? "Tailor again" : "✨ Tailor to me"}</button>` : "<span></span>"}</div>
      <button class="btn primary" data-act="game-log">Done? Log this practice</button>`
      : `<div class="card"><p class="muted">No games for that choice yet. Try another place or more time.</p></div>`}
      <p class="muted" style="text-align:center">Targets are set for your level. Write your scores in the practice log so Karina can see them.</p>
    </main>`;
  }
  function cardTable(card) {
    const app = h => (h.app?.res || []).map(x => ({ G: "✓", S: "S", Lg: "Lg", L: "L", R: "R" }[x])).join("");
    const tee = h => h.par < 4 ? "" : { fw: "✓", L: "L", R: "R" }[h.tee?.res] || "";
    return `<div class="scroll"><table class="sc-card"><thead><tr><th>Hole</th>${card.map(h => `<th>${esc(h.n)}</th>`).join("")}</tr></thead><tbody>
      <tr><td>Par</td>${card.map(h => `<td>${esc(h.par)}</td>`).join("")}</tr>
      <tr class="sc-score"><td>Score</td>${card.map(h => `<td class="${h.score - h.par < 0 ? "u" : h.score - h.par >= 2 ? "o2" : h.score - h.par === 1 ? "o" : ""}">${esc(h.score)}</td>`).join("")}</tr>
      <tr><td>Tee</td>${card.map(h => `<td>${tee(h)}</td>`).join("")}</tr>
      ${card.some(h => (h.app?.res || []).length) ? `<tr><td>Green</td>${card.map(h => `<td>${app(h)}</td>`).join("")}</tr>` : ""}
      <tr><td>Putts</td>${card.map(h => `<td>${esc(h.putts ?? "")}</td>`).join("")}</tr></tbody></table></div>`;
  }
  // AI review of one round: saved on the round so Karina sees it too.
  function reviewHtml(r) {
    const rv = r.review || (S.reviews[r.id] && S.reviews[r.id].review);
    const busy = S.reviews[r.id]?.busy;
    if (busy) return `<div class="review"><p class="muted">Reviewing your round…</p></div>`;
    if (!rv) return S.aiAvailable ? `<button class="btn primary" data-act="review-round">✨ Review this round</button>` : "";
    const g = GAMES.find(x => x.id === rv.game_id);
    const list = (t, a) => a?.length ? `<h3 class="sh3">${t}</h3><ul>${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
    return `<div class="review"><b class="rv-head">${esc(rv.headline || "Round review")}</b>
      ${list("What went well", rv.good)}${list("Where the strokes went", rv.cost)}
      ${rv.focus ? `<h3 class="sh3">Work on this next</h3><p>${esc(rv.focus)}</p>` : ""}
      ${rv.mental ? `<h3 class="sh3">Mental note</h3><p>${esc(rv.mental)}</p>` : ""}
      ${g ? `<button class="btn primary" data-act="review-game" data-game="${esc(g.id)}">Practice it: ${esc(g.name)}</button>` : ""}
      <small class="rv-foot">AI review based on your stats and notes. Karina sees it too.</small></div>`;
  }
  async function reviewRound(id) {
    const r = S.entries.find(e => e.id === id);
    if (!r) return;
    S.reviews[id] = { busy: true }; render();
    try {
      const g = goal() || {};
      const prev = byDateDesc(of("stat")).filter(x => x.id !== id && String(x.holes || "18") === String(r.holes || "18")).slice(0, 5)
        .map(x => ({ date: x.date, score: x.score, putts: x.putts, fairways: x.fairways, gir: x.gir, updown: x.updown }));
      const strip = ({ id: _i, type, student_id, author, created_by, created_at, updated_at, review, ...rest }) => rest;
      const res = await api.reviewRound({
        round: { ...strip(r), card: undefined, patterns: undefined }, patterns: r.patterns || null,
        holes: Array.isArray(r.card) ? r.card.map(h => ({ n: h.n, par: h.par, score: h.score, putts: h.putts, first_putt_ft: h.fp, penalties: h.pen, penalty_from: h.penFrom, recovery: h.rec, tee: h.par >= 4 ? h.tee : undefined, approach: h.app, around_green: (h.app?.res || []).length && !h.app.res.includes("G") ? h.sg : undefined })) : null,
        previous: prev, target: targetScore(),
        benchmark: String(r.holes || "18") === "18" ? benchmark(targetScore()) : null,
        player: { handicap: S.profile?.handicap || "", group: S.profile?.grp || "", goals: g.m3 || {}, drills: of("drill").filter(d => d.status !== "Mastered").map(d => d.name), club_carries: carried(myBag()).map(c => `${c.club} ${c.carry}`) },
        games: GAMES.map(x => ({ id: x.id, name: x.name, place: x.place, helps: x.helps }))
      });
      if (!S.entries.some(e => e.id === id)) return; // player switched
      S.reviews[id] = { review: res };
      if (r.author === "student") { try { await api.updateEntry(r, { review: res }); await load(); } catch {} }
    } catch (err) { S.reviews[id] = null; toast(err?.message && !/fetch/i.test(err.message) ? err.message : "Couldn't review right now. Try again later."); }
    render();
  }
  const sessionKey = games => games.map(g => g.id).join(",") + "|" + S.game.minutes;

  function goalsScreen() {
    const g = goal() || {};
    const has = GOAL_PERIODS.some(([pk]) => GOAL_FIELDS.some(f => g[pk]?.[f.k]));
    const val = (pk, k) => { const id = `g-${pk}-${k}`; return id in S.goalDraft ? S.goalDraft[id] : (g[pk]?.[k] || ""); };
    const mine = myAverages(of("stat"));
    if (S.calc == null) {
      const m = String(g.m3?.score || "").match(/\b(6\d|7\d|8\d|9\d|1[01]\d)\b/);
      S.calc = m ? +m[1] : mine?.score ? Math.max(70, Math.round(mine.score) - 3) : 90;
    }
    return top("My goals", S.profile?.name || "") + `<main class="s-content">
      <details class="card guide" ${has ? "" : "open"}><summary>Why goals matter, and the 4 kinds to set</summary>${GOAL_GUIDE}</details>
      ${g.coach_note ? `<section class="card coach-note"><h2>Karina's note on your goals ${g.coach_note_at ? `<span>${esc(shortDate(g.coach_note_at))}</span>` : ""}</h2><p>${esc(g.coach_note)}</p></section>` : ""}
      <form id="goalForm" novalidate class="goal-form">
        ${GOAL_PERIODS.map(([pk, pl]) => `<section class="card"><h2>${pl}</h2>
          ${GOAL_FIELDS.map(f => `<div class="field"><label for="g-${pk}-${f.k}">${f.l} <small>${f.hint}</small></label><textarea id="g-${pk}-${f.k}" rows="2" placeholder="${esc(f.ph[pk])}">${esc(val(pk, f.k))}</textarea></div>`).join("")}
        </section>`).join("")}
        <button type="submit" class="btn primary">Save my goals</button>
        ${g.updated_at ? `<p class="muted" style="text-align:center">Last saved ${esc(shortDate(g.updated_at))}. Karina sees your goals.</p>` : `<p class="muted" style="text-align:center">Karina will see your goals and can add a note.</p>`}
      </form>
      <section class="card"><h2>What does your score goal take?</h2>
        <div class="calc"><label for="calc">Target score (18 holes)</label><input id="calc" type="number" inputmode="numeric" min="70" max="110" value="${esc(S.calc)}"></div>
        <div id="benchOut">${benchmarkTable(S.calc, mine, esc)}</div>
        <p class="muted">Use these numbers to write your performance goal. Lower scores mostly come from hitting more greens and saving more strokes around the green.</p>
      </section>
    </main>`;
  }
  function roundsScreen() {
    const r = byDateDesc(of("stat"));
    const e18 = r.filter(x => String(x.holes || "18") === "18");
    const avg = k => { const v = e18.filter(x => x[k] !== "" && x[k] != null && !isNaN(+x[k])).map(x => +x[k]); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–"; };
    return top("My rounds", S.profile?.name || "") + `<main class="s-content">
      <div class="stats"><div><b>${avg("score")}</b><small>Avg score (18)</small></div><div><b>${avg("putts")}</b><small>Avg putts</small></div><div><b>${avg("gir")}</b><small>Avg greens</small></div></div>
      ${S.live ? `<section class="card live-resume"><h2>Round in progress</h2><p style="margin:0"><b>${esc(S.live.course || "Your round")}</b> · ${S.live.mode === "full" ? "Full" : "Quick"} · ${liveThru()}</p>
        <div class="row2"><button class="btn" data-act="live-discard">Discard</button><button class="btn primary" data-act="live-resume">Resume</button></div></section>` : ""}
      ${S.logOpen ? logForm() : `<button class="btn primary" data-act="live-new">⛳ Track a round hole by hole</button><button class="btn" data-act="log">Enter totals only</button>`}
      <button class="bag-link" data-go="bag"><span><b>My club distances</b><small>${carried(myBag()).length ? `${carried(myBag()).length} clubs · updated ${esc(shortDate(bagEntry().updated_at))}` : "Add how far you hit each club"}</small></span><span class="chev">›</span></button>
      ${r.length >= 2 ? `<section class="card"><h2>Your trend</h2>${trendHtml(r, S.trend)}</section>` : ""}
      <section class="card"><h2>Recent rounds</h2>${r.map(x => { const d = dateParts(x.date); return `<button class="round" data-round="${esc(x.id)}"><span class="date"><b>${d.d}</b><small>${esc(d.mon || "")}</small></span>
        <span><span style="font-weight:600;display:block">${esc(x.course || x.event || "Round")}</span><span class="meta">${esc(x.event || "")} · ${esc(x.holes || "18")} holes${x.putts !== "" && x.putts != null ? ` · ${esc(x.putts)} putts` : ""}${x.fairways ? ` · FW ${esc(x.fairways)}` : ""}</span></span>
        <span class="sc">${esc(x.score)}</span></button>`; }).join("") || `<p class="muted">No rounds yet. Log your next one after you play.</p>`}</section></main>`;
  }
  // ---------- club distances
  function bagScreen() {
    if (!S.bagDraft) S.bagDraft = sortBag(myBag().length ? myBag().map(c => ({ ...c })) : newBag());
    const bag = S.bagDraft, e = bagEntry();
    const c = carried(bag), max = c.length ? c[0].carry : 1;
    const notes = gapNotes(bag);
    return top("My bag", S.profile?.name || "") + `<main class="s-content">
      <section class="card"><h2>Fill it in fast</h2>
        <label class="btn primary photo-btn">${S.bagBusy ? "Reading your photo…" : "📷 Read from a photo"}<input type="file" accept="image/*" id="bagPhoto" hidden ${S.bagBusy ? "disabled" : ""}></label>
        <p class="muted">A photo or screenshot of a launch monitor report, a yardage card, or a list you wrote. You check the numbers before saving.</p>
        <div class="lv-row"><label>Or: my 7 iron carries <input class="lv-num" id="bag7" inputmode="numeric" placeholder="yds"></label><button class="btn" data-act="bag-est">Estimate the rest</button></div>
      </section>
      <form id="bagForm" class="card" novalidate><h2>Club distances <span>yards</span></h2>
        <div class="bag-head"><span></span><span>Club</span><span>Carry</span><span>Total</span></div>
        ${bag.map((r, i) => `<div class="bag-row ${r.on === false ? "off" : ""}">
          <input type="checkbox" data-bagon="${i}" ${r.on !== false ? "checked" : ""} aria-label="${esc(r.club)} is in my bag">
          <input class="bag-name" data-bag="${i}.club" value="${esc(r.club)}" aria-label="Club name">
          <input class="lv-num" data-bag="${i}.carry" inputmode="numeric" value="${esc(r.carry)}" placeholder="–" aria-label="${esc(r.club)} carry">
          <input class="lv-num" data-bag="${i}.total" inputmode="numeric" value="${esc(r.total)}" placeholder="–" aria-label="${esc(r.club)} total"></div>`).join("")}
        <button type="button" class="linkbtn" data-act="bag-add">+ Add a club</button>
        <p class="muted">Carry = where the ball lands. Total = where it stops. Untick clubs you don't carry. Use your normal, solid shot, not your best one.</p>
        <button class="btn primary" type="submit">Save my bag</button>
        ${e ? `<p class="muted" style="text-align:center">Last saved ${esc(shortDate(e.updated_at))}. Karina sees your distances.</p>` : ""}
      </form>
      ${c.length ? `<section class="card"><h2>Your gapping</h2><div class="gaps">${c.map(x => `<div class="gap-row"><span>${esc(x.club)}</span><i style="width:${Math.max(8, x.carry / max * 100)}%"></i><b>${x.carry}</b></div>`).join("")}</div>
        ${notes.map(n => `<p class="gap-note">${esc(n)}</p>`).join("")}</section>` : ""}
    </main>`;
  }
  const bagHint = yds => { const c = clubsFor(myBag(), yds); return c.length ? "Your bag: " + c.map(x => `${x.club} ${x.carry}`).join(" · ") : ""; };
  const keepBag = () => draft.set(`${S.sid}.bagdraft`, S.bagDraft);
  async function readBagPhoto(file) {
    if (!file) return;
    if (!S.aiAvailable) { toast("Photo reading isn't switched on yet. Type your distances instead."); return; }
    S.bagBusy = true; render();
    const sid = S.sid;
    try {
      const img = await shrinkImage(file, 1400);
      const res = await api.readBagPhoto(img);
      if (sid !== S.sid) return;
      const { bag, count } = mergeInto(S.bagDraft || newBag(), res.clubs || []);
      S.bagDraft = bag; keepBag();
      toast(count ? `Found ${count} club${count > 1 ? "s" : ""}. Check the numbers, then Save.` : "Couldn't find club distances in that photo.");
    } catch (err) { toast(err?.message && !/fetch/i.test(err.message) ? err.message : "Couldn't read that photo. Try a clearer one."); }
    S.bagBusy = false; render();
  }
  // Downsizes a photo in the browser so it uploads fast.
  function shrinkImage(file, maxSide) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const k = Math.min(1, maxSide / Math.max(im.width, im.height));
        const cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        resolve(cv.toDataURL("image/jpeg", 0.82).split(",")[1]);
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a photo the app can read.")); };
      im.src = url;
    });
  }

  // ---------- hole-by-hole round tracker
  const liveKey = () => `${S.sid}.live`;
  const saveLive = () => draft.set(liveKey(), S.live);
  const liveThru = () => { const L = S.live; if (!L) return ""; const t = totals(L.card); return t.holes ? `${t.score - t.par >= 0 ? "+" : ""}${t.score - t.par} thru ${t.holes}` : "not started"; };
  const parsFor = course => {
    const k = String(course || "").trim().toLowerCase();
    if (!k) return null;
    try { const p = JSON.parse(localStorage.getItem("sph.pars." + k) || "null"); if (p) return p; } catch {}
    const prev = byDateDesc(of("stat")).find(x => String(x.course || "").trim().toLowerCase() === k && Array.isArray(x.card));
    return prev ? Object.fromEntries(prev.card.map(h => [h.n, h.par])) : null;
  };
  function liveSetupHtml() {
    const st = S.liveSetup;
    const courses = [...new Set(of("stat").map(x => x.course).filter(Boolean))];
    const opt = (attr, list, cur) => `<div class="pick">${list.map(([v, l]) => `<button type="button" class="pick-btn" data-${attr}="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
    return top("New round", S.profile?.name || "") + `<main class="s-content"><section class="card">
      <div class="field"><label for="lv-course">Course</label><input id="lv-course" list="lv-courses" autocomplete="off" value="${esc(st.course)}" placeholder="e.g. Renaissance Park"><datalist id="lv-courses">${courses.map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
      <div class="row2"><div class="field"><label for="lv-date">Date</label><input id="lv-date" type="date" value="${esc(st.date)}"></div>
        <div class="field"><label for="lv-event">Type</label><select id="lv-event">${["Casual", "Practice round", "Tournament"].map(o => `<option ${o === st.event ? "selected" : ""}>${o}</option>`).join("")}</select></div></div>
      <fieldset class="field"><legend>Holes</legend>${opt("lsholes", [["18", "18 holes"], ["front", "Front 9"], ["back", "Back 9"]], st.holes)}</fieldset>
      <fieldset class="field"><legend>How much do you want to track?</legend>${opt("lsmode", [["quick", "Quick"], ["full", "Full"]], st.mode)}
        <p class="muted">${st.mode === "full" ? "Full: tee shot misses and start line, approach club, distance and miss, chips, first putt distance, penalties. About 20 seconds a hole." : "Quick: score, putts, fairway and penalties. About 5 seconds a hole."}</p></fieldset>
      <button class="btn primary" data-act="live-start">Start on hole ${st.holes === "back" ? 10 : 1}</button></section></main>`;
  }
  function liveHtml() {
    const L = S.live, h = L.card[L.cur], full = L.mode === "full";
    const b = (path, val, label, on, cls = "") => `<button type="button" class="pick-btn ${cls}" data-lv="${path}" data-val="${esc(val)}" aria-pressed="${!!on}">${label}</button>`;
    const sec = (title, inner) => `<div class="lv-sec"><h3 class="sh3">${title}</h3>${inner}</div>`;
    const clubSel = (path, cur) => `<select class="lv-club" data-lvsel="${path}" aria-label="Club"><option value="">Club</option>${CLUBS.map(c => `<option ${c === cur ? "selected" : ""}>${c}</option>`).join("")}</select>`;
    const missedGreen = (h.app.res || []).length && !h.app.res.includes("G");
    const scores = [h.par - 2, h.par - 1, h.par, h.par + 1, h.par + 2, h.par + 3].filter(v => v >= 1);
    const names = { [-2]: h.par === 3 ? "Ace" : "Eagle", [-1]: "Birdie", 0: "Par", 1: "Bogey", 2: "Double", 3: "Triple" };
    const t = totals(L.card);
    return `<header class="lv-top"><button class="linkbtn" data-act="live-leave">‹ Rounds</button><span>${esc(L.course || "Round")} · ${t.holes ? `${t.score - t.par >= 0 ? "+" : ""}${t.score - t.par} thru ${t.holes}` : "Hole 1"}</span></header>
      <main class="s-content lv">
      <div class="lv-strip">${L.card.map((x, i) => `<button data-lvgo="${i}" class="${i === L.cur ? "cur" : ""} ${x.score != null ? "done" : ""}" aria-label="Hole ${x.n}">${x.n}${x.score != null ? `<small>${x.score}</small>` : ""}</button>`).join("")}</div>
      <section class="card lv-card">
        <div class="lv-head"><h2 class="lv-hole">Hole ${h.n}</h2><div class="pick">${[3, 4, 5].map(p => b("par", p, "Par " + p, h.par === p, "sm")).join("")}</div></div>
        ${sec("Score", `<div class="pick lv-score">${scores.map(v => b("score", v, `<b>${v}</b><small>${names[v - h.par] || ""}</small>`, h.score === v)).join("")}${b("score", Math.max(h.score ?? 0, h.par + 3) + 1, h.score > h.par + 3 ? `<b>${h.score}</b><small>+ more</small>` : "<b>+</b><small>more</small>", h.score > h.par + 3)}</div>`)}
        ${h.par >= 4 ? sec("Tee shot", `<div class="pick">${b("tee.res", "fw", "Fairway", h.tee.res === "fw")}${b("tee.res", "L", "← Left", h.tee.res === "L")}${b("tee.res", "R", "Right →", h.tee.res === "R")}${full ? clubSel("tee.club", h.tee.club) : ""}</div>
          ${full && (h.tee.res === "L" || h.tee.res === "R") ? `<div class="pick lv-start">${b("tee.start", "curve", "Started on target, curved away", h.tee.start === "curve")}${b("tee.start", "off", "Started off target, stayed there", h.tee.start === "off")}</div>` : ""}`) : ""}
        ${full ? sec(h.par === 3 ? "Tee shot (into the green)" : "Shot into the green", `<div class="lv-row"><label>Distance <input class="lv-num" data-lvin="app.yds" inputmode="numeric" value="${esc(h.app.yds)}" placeholder="yds"></label>${clubSel("app.club", h.app.club)}</div>
          <p class="bag-hint" id="bagHint">${esc(bagHint(h.app.yds))}</p>
          <div class="pick">${b("app", "G", "On the green", h.app.res.includes("G"), "good")}${[["S", "Short"], ["Lg", "Long"], ["L", "Left"], ["R", "Right"]].map(([v, l]) => b("app", v, l, h.app.res.includes(v))).join("")}</div>
          <p class="muted">Missed? Tap up to two, e.g. Short + Right.</p>`) : ""}
        ${full && missedGreen ? sec("Around the green", `<div class="pick">${b("sg.kind", "chip", "Chip / pitch", h.sg.kind === "chip")}${b("sg.kind", "bunker", "Bunker", h.sg.kind === "bunker")}</div>
          ${h.sg.kind === "chip" ? `<div class="pick">${b("sg.land", "on", "Hit my landing spot", h.sg.land === "on", "good")}${b("sg.land", "short", "Landed short", h.sg.land === "short")}${b("sg.land", "long", "Landed past it", h.sg.land === "long")}</div>`
            : `<div class="pick">${b("sg.out", "yes", "Out in one", h.sg.out === true, "good")}${b("sg.out", "no", "Took more than one", h.sg.out === false)}</div>`}
          <div class="lv-row"><span>Shots to get on the green</span><span class="stepper sm"><button type="button" data-lvstep="sg.shots" data-d="-1">−</button><output>${h.sg.shots}</output><button type="button" data-lvstep="sg.shots" data-d="1">+</button></span></div>`) : ""}
        ${sec("Putts", `${full ? `<div class="lv-row"><label>First putt <input class="lv-num" data-lvin="fp" inputmode="numeric" value="${esc(h.fp)}" placeholder="ft"></label></div>` : ""}<div class="pick">${[0, 1, 2, 3, 4].map(v => b("putts", v, v, h.putts === v)).join("")}</div>`)}
        ${sec("Penalties & trouble", `<div class="lv-row"><span>Penalty strokes</span><span class="stepper sm"><button type="button" data-lvstep="pen" data-d="-1">−</button><output>${h.pen}</output><button type="button" data-lvstep="pen" data-d="1">+</button></span></div>
          ${full && h.pen > 0 ? `<div class="pick">${b("penFrom", "tee", "Off the tee", h.penFrom === "tee")}${b("penFrom", "app", "On the approach", h.penFrom === "app")}${b("penFrom", "other", "Other", h.penFrom === "other")}</div>` : ""}
          ${full ? `<div class="pick">${b("rec", h.rec ? "" : "1", "Hit a punch-out / recovery shot", h.rec)}</div>` : ""}`)}
      </section>
      <div class="row2">${L.cur > 0 ? `<button class="btn" data-act="live-prev">‹ Hole ${L.card[L.cur - 1].n}</button>` : "<span></span>"}
        ${L.cur < L.card.length - 1 ? `<button class="btn primary" data-act="live-next">Hole ${L.card[L.cur + 1].n} ›</button>` : `<button class="btn primary" data-act="live-finish">Finish round</button>`}</div>
      ${L.cur < L.card.length - 1 && t.holes >= Math.min(9, L.card.length) ? `<button class="btn" data-act="live-finish">Finish round now (${t.holes} holes)</button>` : ""}
      </main>`;
  }
  function liveFinishHtml() {
    const L = S.live, t = totals(L.card), lines = patternLines(patterns(L.card));
    return top("Round done", L.course || "") + `<main class="s-content">
      <section class="card"><div class="stats"><div><b>${t.score}</b><small>${t.score - t.par >= 0 ? "+" : ""}${t.score - t.par} · ${t.holes} holes</small></div><div><b>${t.putts === "" ? "–" : t.putts}</b><small>Putts</small></div><div><b>${t.gir}</b><small>Greens</small></div></div>
        <div class="mini-stats">${[["Fairways", t.fairways], ["Up & downs", t.updown], ["Penalties", t.penalties], ["3-putts", t.threeputts]].filter(([, v]) => v !== "").map(([k, v]) => `<span class="mini-stat">${k}: <b>${esc(v)}</b></span>`).join("")}</div></section>
      ${lines.length ? `<section class="card"><h2>Your patterns</h2>${lines.map(([k, v]) => `<p class="pat"><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</section>` : ""}
      <form id="liveForm" class="card" novalidate><div class="field"><label for="lv-notes">How did it go?</label><textarea id="lv-notes" placeholder="e.g. Felt rushed after the bad hole on 12. Putting felt good.">${esc(L.notes || "")}</textarea></div>
        <button class="btn primary" type="submit">Save round</button><button type="button" class="btn" data-act="live-back">Back to the holes</button></form></main>`;
  }
  function liveScreen() { return S.liveSetup ? liveSetupHtml() : !S.live ? roundsScreen() : S.live.finishing ? liveFinishHtml() : liveHtml(); }
  function setPath(obj, path, val) { const k = path.split("."); let o = obj; k.slice(0, -1).forEach(x => { o = o[x]; }); o[k[k.length - 1]] = val; }
  function getPath(obj, path) { return path.split(".").reduce((o, x) => o?.[x], obj); }
  function liveTap(el) {
    const L = S.live, h = L.card[L.cur];
    if (el.dataset.lvgo != null) { L.cur = +el.dataset.lvgo; saveLive(); render(); window.scrollTo(0, 0); return; }
    if (el.dataset.lvstep) {
      const p = el.dataset.lvstep, min = p === "sg.shots" ? 1 : 0;
      setPath(h, p, Math.max(min, Math.min(9, (+getPath(h, p) || 0) + +el.dataset.d)));
    } else {
      const p = el.dataset.lv, v = el.dataset.val;
      if (p === "app") {
        let r = h.app.res.filter(x => x !== "G");
        if (v === "G") r = h.app.res.includes("G") ? [] : ["G"];
        else if (r.includes(v)) r = r.filter(x => x !== v);
        else { const opp = { S: "Lg", Lg: "S", L: "R", R: "L" }[v]; r = r.filter(x => x !== opp); r.push(v); r = r.slice(-2); }
        h.app.res = r;
      } else if (["par", "score", "putts"].includes(p)) {
        const n = +v; setPath(h, p, getPath(h, p) === n && p !== "par" ? null : n);
        if (p === "par") { L.pars = { ...(L.pars || {}), [h.n]: n }; }
      } else if (p === "sg.out") h.sg.out = h.sg.out === (v === "yes") ? null : v === "yes";
      else if (p === "rec") h.rec = !!v;
      else setPath(h, p, getPath(h, p) === v ? "" : v);
      if (p === "tee.res" && h.tee.res !== "L" && h.tee.res !== "R") h.tee.start = "";
      if (p === "pen" && !h.pen) h.penFrom = "";
    }
    saveLive(); render();
  }
  async function liveSave() {
    const L = S.live, t = totals(L.card);
    if (!t.holes) { toast("Enter a score on at least one hole."); return; }
    const card = L.card.filter(h => h.score != null);
    const notes = root.querySelector("#lv-notes")?.value.trim() || "";
    const d = { date: L.date || today(), event: L.event, course: L.course, holes: t.holes === 18 ? "18" : t.holes === 9 ? "9" : String(t.holes), holes_played: t.holes, score: t.score, putts: t.putts, fairways: t.fairways, gir: t.gir, updown: t.updown,
      penalties: t.penalties, threeputts: t.threeputts, doubles: t.doubles, par: t.par, notes, mode: L.mode, card, patterns: patterns(card) };
    try { if (L.course) localStorage.setItem("sph.pars." + L.course.trim().toLowerCase(), JSON.stringify(Object.fromEntries(L.card.map(h => [h.n, h.par])))); } catch {}
    let saved = null;
    const ok = await run(async () => { saved = await api.addEntry(S.sid, "stat", d); }, "Round saved");
    if (!ok) return;
    draft.clear(liveKey()); clearDrafts("liveForm"); S.live = null; S.screen = "rounds";
    if (saved) { S.sheet = { kind: "round", id: saved.id }; render(); if (S.aiAvailable) reviewRound(saved.id); } else render();
  }

  function logForm() {
    return `<form class="card" id="roundForm" novalidate><h2>Log a round</h2>
      <div class="row2"><div class="field"><label for="r-date">Date</label><input id="r-date" type="date" value="${today()}"></div>
      <div class="field"><label for="r-event">Type</label><select id="r-event"><option>Casual</option><option>Practice round</option><option>Tournament</option></select></div></div>
      <div class="row2"><div class="field"><label for="r-course">Course</label><input id="r-course" autocomplete="off"></div>
      <div class="field"><label for="r-holes">Holes</label><select id="r-holes"><option>18</option><option>9</option></select></div></div>
      <div class="row2"><div class="field"><label for="r-score">Score *</label><input id="r-score" inputmode="numeric"></div><div class="field"><label for="r-putts">Putts</label><input id="r-putts" inputmode="numeric"></div></div>
      <div class="row2"><div class="field"><label for="r-fw">Fairways (e.g. 8/14)</label><input id="r-fw"></div><div class="field"><label for="r-gir">Greens in regulation</label><input id="r-gir" inputmode="numeric"></div></div>
      <div class="row2"><div class="field"><label for="r-ud">Up & downs (e.g. 3/7)</label><input id="r-ud"></div><div class="field"><label for="r-pen">Penalty strokes</label><input id="r-pen" inputmode="numeric"></div></div>
      <div class="row2"><div class="field"><label for="r-3p">3-putts</label><input id="r-3p" inputmode="numeric"></div><div class="field"><label for="r-dbl">Double bogeys or worse</label><input id="r-dbl" inputmode="numeric"></div></div>
      <div class="field"><label for="r-notes">How did it go?</label><textarea id="r-notes" placeholder="e.g. Drove it well on the front, lost 3 balls right on the back. Felt rushed after the bad hole on 12."></textarea></div>
      <div class="row2"><button type="button" class="btn" data-act="cancel-log">Cancel</button><button type="submit" class="btn primary">Save round</button></div></form>`;
  }
  function lessonsScreen() {
    const lessons = byDateDesc(of("lesson"));
    const order = { "In progress": 0, "Assigned": 1, "Mastered": 2 };
    const drills = of("drill").slice().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    const fit = byDateDesc(of("fitness"));
    return top("Lessons", S.profile?.name || "") + `<main class="s-content">
      <div class="readonly">${LOCK}Written by Karina</div>
      ${drills.length ? `<section class="card"><h2>My drills</h2>${drills.map(d => { const l = lastScore(d.id); const st = d.status === "Mastered" ? ["good", "Mastered"] : l && d.goal && l.score >= +d.goal ? ["good", "Target hit"] : l ? ["warn", `${l.score}/${l.out_of}`] : ["n", d.status || "Assigned"];
        return `<button class="drill" data-drill="${esc(d.id)}"><span><span class="t" style="display:block">${esc(d.name)}</span><span class="tg">${d.goal ? `Target: ${esc(d.goal)}/${esc(d.of || 10)} ` : ""}${esc(d.target || d.category || "")}</span></span><span class="pill ${st[0]}">${esc(st[1])}</span></button>`; }).join("")}</section>` : ""}
      ${lessons.map(l => `<section class="card lesson"><div class="dt">${esc(fmtDate(l.date))}${l.kind ? " · " + esc(l.kind) : ""}</div><div class="t">${esc(l.focus)}</div>${l.notes ? `<p>${esc(l.notes)}</p>` : ""}${l.homework ? `<div class="hw"><b>Homework:</b> ${esc(l.homework)}</div>` : ""}${videoThumb(l.video_pid, "Lesson video")}${demoLink(l.video, "Watch lesson video")}</section>`).join("")}
      ${fit.length ? `<section class="card"><h2>Fitness</h2>${fit.map(f => `<div class="drill" style="cursor:default"><span><span class="t" style="display:block">${esc(f.name)}${f.dose ? ` <span class="tg">· ${esc(f.dose)}</span>` : ""}</span><span class="tg">${esc(f.kind || "")}${f.notes ? " · " + esc(f.notes) : ""}</span>${f.video_pid ? `<span style="display:block;margin-top:8px">${videoThumb(f.video_pid, "Watch demo")}</span>` : ""}</span>${f.result && f.result !== "—" ? `<span class="pill ${f.result === "Pass" ? "good" : f.result === "Fail" ? "bad" : f.result === "Needs work" ? "warn" : "n"}">${esc(f.result)}</span>` : ""}</div>`).join("")}</section>` : ""}
      ${!lessons.length && !drills.length && !fit.length ? `<div class="card"><p class="muted">Karina's lesson notes and drills will show up here.</p></div>` : ""}
    </main>`;
  }
  function notesScreen() {
    const notes = of("note").slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    return top("Notes", S.profile?.name || "") + `<main class="s-content">
      <section class="card"><h2>With Karina</h2><div class="thread">${notes.map(n => `<div class="msg ${n.author === "coach" ? "coach" : "me"}">${n.text ? esc(n.text) : ""}${n.video_pid ? `<div style="margin-top:${n.text ? 8 : 0}px">${videoThumb(n.video_pid, n.author === "coach" ? "Karina's video" : "Your swing")}</div>` : ""}<small>${n.author === "coach" ? "Karina" : "You"} · ${esc(shortDate(n.created_at))}</small></div>`).join("") || `<p class="muted">No notes yet. Ask a question or tell Karina how practice went.</p>`}</div></section>
      <form class="card" id="noteForm" novalidate><label for="note" style="font-size:12px;font-weight:600;color:var(--ink-2)">New note, question or swing video</label><textarea id="note" placeholder="How practice went, or a question for your next lesson"></textarea><div id="noteVideo"></div><button class="btn primary" type="submit">Send to Karina</button></form>
    </main>`;
  }
  function nav() {
    const items = [["home", "Home"], ["plan", "Plan"], ["goals", "Goals"], ["rounds", "Rounds"], ["lessons", "Lessons"], ["notes", "Notes"]];
    return `<nav class="nav" aria-label="Sections"><div>${items.map(([k, l]) => `<button data-go="${k}" ${({ games: "plan", live: "rounds", bag: "rounds" }[S.screen] || S.screen) === k ? 'aria-current="page"' : ""}>${ICON[k]}${l}</button>`).join("")}</div></nav>`;
  }

  // ---------- sheets
  function sheetHtml() {
    const sh = S.sheet;
    if (!sh) return "";
    const wrap = (label, inner) => `<div class="sheet-bg" data-close="1"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="grab"></div>${inner}</div>`;
    if (sh.kind === "menu") {
      return wrap("Account", `<h2>${esc(S.profile?.name || "")}</h2>
        ${S.students.length > 1 ? `<p>Switch player</p>${S.students.map(s => `<button class="menu-item" data-switch="${esc(s.id)}" aria-current="${s.id === S.sid}">${esc(s.name)}<span>${s.id === S.sid ? "✓" : "›"}</span></button>`).join("")}` : ""}
        <button class="menu-item" data-go="bag">My club distances<span>›</span></button>
        <p>Tip: add this app to your home screen. On iPhone, tap Share, then "Add to Home Screen".</p>
        <button class="btn" data-act="signout">Sign out</button><button class="btn" data-close="1">Close</button>`);
    }
    if (sh.kind === "round") {
      const r = S.entries.find(e => e.id === sh.id);
      if (!r) return "";
      return wrap("Round", `<h2>${esc(r.score)} at ${esc(r.course || "the course")}</h2>
        <p>${esc(fmtDate(r.date))} · ${esc(r.event || "")} · ${esc(r.holes || "18")} holes</p>
        <div class="stats"><div><b>${esc(r.putts ?? "–") || "–"}</b><small>Putts</small></div><div><b>${esc(r.fairways || "–")}</b><small>Fairways</small></div><div><b>${esc(r.gir ?? "–") || "–"}</b><small>Greens</small></div></div>
        ${[["Up & downs", r.updown], ["Penalties", r.penalties], ["3-putts", r.threeputts], ["Doubles+", r.doubles]].filter(([, v]) => v !== "" && v != null).map(([k, v]) => `<span class="mini-stat">${k}: <b>${esc(v)}</b></span>`).join("") ? `<div class="mini-stats">${[["Up & downs", r.updown], ["Penalties", r.penalties], ["3-putts", r.threeputts], ["Doubles+", r.doubles]].filter(([, v]) => v !== "" && v != null).map(([k, v]) => `<span class="mini-stat">${k}: <b>${esc(v)}</b></span>`).join("")}</div>` : ""}
        ${r.notes ? `<p>${esc(r.notes)}</p>` : ""}
        ${r.patterns ? `<div class="pats"><h3 class="sh3">Your patterns</h3>${patternLines(r.patterns).map(([k, v]) => `<p class="pat"><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</div>` : ""}
        ${Array.isArray(r.card) ? cardTable(r.card) : ""}
        ${reviewHtml(r)}
        ${r.author === "student" ? `<button class="btn danger" data-act="del-round">Delete round</button>` : ""}<button class="btn" data-close="1">Close</button>`);
    }
    if (sh.kind === "session") {
      const x = S.entries.find(e => e.id === sh.id);
      if (!x) return "";
      return wrap("Practice", `<h2>Practice${x.minutes ? `, ${esc(x.minutes)} min` : ""}</h2>
        <p>${esc(fmtDate(x.date))}${x.rating ? ` · felt ${esc(RATINGS[+x.rating - 1].toLowerCase())}` : ""}</p>
        ${(x.areas || []).length ? `<div class="sess-areas">${x.areas.map(areaChip).join("")}</div>` : ""}
        ${x.worked ? `<div><h3 class="sh3">What I practiced</h3><p>${esc(x.worked)}</p></div>` : ""}
        ${x.went ? `<div><h3 class="sh3">How it went</h3><p>${esc(x.went)}</p></div>` : ""}
        ${x.next ? `<div><h3 class="sh3">Next time</h3><p>${esc(x.next)}</p></div>` : ""}
        ${x.author === "student" ? `<button class="btn danger" data-act="del-sess">Delete</button>` : ""}<button class="btn" data-close="1">Close</button>`);
    }
    if (sh.kind === "drill") {
      const dr = drillById(sh.id);
      if (!dr) return "";
      return wrap(dr.name, `${areaChip(dr.category)}<h2>${esc(dr.name)}</h2>${dr.notes ? `<p>${esc(dr.notes)}</p>` : ""}
        ${videoThumb(dr.video_pid, "Karina's demo")}${demoLink(dr.video, "Watch Karina's demo")}
        ${dr.goal ? `<div class="target"><b>${esc(dr.goal)}/${esc(dr.of || 10)}</b><span>Target${dr.target ? ": " + esc(dr.target) : ""}</span></div>` : ""}
        <div><h3 style="margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)">Your scores</h3>${hist(dr)}</div>
        ${dr.goal ? `<button class="btn primary" data-act="score-drill">Log a score</button>` : ""}<button class="btn" data-close="1">Close</button>`);
    }
    const p = S.entries.find(e => e.id === sh.id);
    if (!p) return "";
    const dr = p.drill && drillById(p.drill);
    if (sh.kind === "score") {
      const drl = dr || drillById(sh.drill);
      const out = +drl.of || 10;
      return wrap("Log your score", `${areaChip(p.area || drl.category)}<h2>How did it go?</h2><p>${esc(drl.name)}${drl.target ? `: how many ${esc(drl.target)}?` : ""}</p>
        <div class="stepper"><button type="button" data-step="-1" aria-label="One less">−</button><output id="scoreOut" aria-live="polite">${sh.val}<small> / ${out}</small></output><button type="button" data-step="1" aria-label="One more">+</button></div>
        ${drl.goal ? `<div class="target"><b>${esc(drl.goal)}/${out}</b><span>Karina's target. ${sh.val >= +drl.goal ? "You hit it!" : `${+drl.goal - sh.val} more to go.`}</span></div>` : ""}
        <div class="row2"><button class="btn" data-close="1">Cancel</button><button class="btn primary" data-act="save-score">${p.type === "plan" && !p.done ? "Save and check off" : "Save score"}</button></div>`);
    }
    return wrap(p.title, `${areaChip(p.area)}<h2>${esc(p.title)}</h2>
      ${dr && dr.notes ? `<p>${esc(dr.notes)}</p>` : ""}${p.details ? `<p>${esc(p.details)}</p>` : ""}
      ${dr ? videoThumb(dr.video_pid, "Karina's demo") + demoLink(dr.video, "Watch Karina's demo") : demoLink(p.video, "Watch the demo")}
      ${dr && dr.goal ? `<div class="target"><b>${esc(dr.goal)}/${esc(dr.of || 10)}</b><span>Target${dr.target ? ": " + esc(dr.target) : ""}</span></div>
        <div><h3 style="margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)">Your scores</h3>${hist(dr)}</div>`
        : `<div class="target"><b>${esc(p.minutes || "–")}</b><span>minutes · ${esc(dayName(blockDate(p)) + ", " + shortDate(blockDate(p)))}</span></div>`}
      ${p.done ? `<button class="btn" data-act="undo-done">Mark not done</button><button class="btn" data-close="1">Close</button>`
        : `<button class="btn primary" data-act="${dr && dr.goal ? "to-score" : "mark-done"}">${dr && dr.goal ? "Log my score" : "Mark done"}</button>`}`);
  }

  // ---------- render
  let noteVideo = null;
  // Text typed into these forms is kept until it's saved, even if the student leaves the screen or closes the app.
  const DRAFTABLE = ["noteForm", "practiceForm", "roundForm", "goalForm"].map(f => `#${f} textarea[id], #${f} input[id]:not([type=checkbox]):not([type=date])`).join(", ");
  const clearDrafts = (formId, sid = S.sid) => { const f = document.getElementById(formId); if (f) f.querySelectorAll("[id]").forEach(el => draft.clear(`${sid}.${el.id}`)); };
  function render() {
    if (root.querySelector(".vprog")) { clearTimeout(render._t); render._t = setTimeout(render, 1500); return; }
    if (S.loading && !S.profile) {
      root.innerHTML = `<div class="center-msg"><div><p>Loading your practice…</p></div></div>`;
      return;
    }
    const scr = { home, plan: planScreen, games: gamesScreen, live: liveScreen, bag: bagScreen, goals: goalsScreen, rounds: roundsScreen, lessons: lessonsScreen, notes: notesScreen }[S.screen]();
    const y = window.scrollY;
    const keep = {};
    root.querySelectorAll("textarea[id],input[id],select[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
    const act = document.activeElement, focusId = act && root.contains(act) ? act.id : "";
    let caret = null; try { caret = focusId && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null; } catch {}
    const prevVideo = noteVideo && S.screen === "notes" ? noteVideo.value : "";
    root.innerHTML = `<div class="s-app">${scr}</div>${nav()}${sheetHtml()}`;
    Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el && el.value !== v) el.value = v; });
    root.querySelectorAll(DRAFTABLE).forEach(el => { const v = draft.get(`${S.sid}.${el.id}`); if (v != null) el.value = v; });
    const nv = document.getElementById("noteVideo");
    noteVideo = nv ? videoField(nv, prevVideo, { label: "Attach a swing video" }) : null;
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus({ preventScroll: true }); try { if (caret) el.setSelectionRange(caret[0], caret[1]); } catch {} } }
    window.scrollTo(0, y);
    document.body.style.overflow = S.sheet && root.querySelector(".sheet") ? "hidden" : "";
    if (S.sheet && !root.querySelector(".sheet")) S.sheet = null; // its entry was deleted
  }
  function openPractice() {
    // Start with the parts of the game from today's plan blocks.
    const todays = plan().filter(x => blockDate(x) === today());
    S.sess = { areas: [...new Set(todays.map(x => x.area).filter(a => AREA_NAMES.includes(a)))], rating: 0 };
    S.screen = "plan"; S.planWeek = null; S.practiceOpen = true; S.logOpen = false; S.sheet = null; render();
    const el = document.getElementById("practice-log"); if (el) el.scrollIntoView({ block: "start" });
  }
  // Opens the practice log filled in with this session's games, ready for scores.
  function logGames() {
    const { games } = currentSession();
    draft.set(`${S.sid}.p-worked`, games.map(g => `${g.name}: score ___ (${g.score.replace(/\.$/, "")})`).join("\n"));
    draft.set(`${S.sid}.p-min`, String(games.reduce((a, g) => a + g.min, 0)));
    S.sess = { areas: [...new Set(games.map(g => g.area).filter(a => AREA_NAMES.includes(a)))], rating: 0, games: games.map(g => g.id), week: S.game.week };
    S.screen = "plan"; S.planWeek = null; S.practiceOpen = true; S.sheet = null; render();
    const el = document.getElementById("practice-log"); if (el) el.scrollIntoView({ block: "start" });
  }
  async function tailor() {
    const { games, focus } = currentSession();
    if (!games.length) return;
    S.game.aiBusy = true; render();
    const sid = S.sid;
    try {
      const g = goal() || {};
      const mine = myAverages(of("stat"));
      const recent = sessions().slice(0, 3).map(x => [x.worked, x.went, x.next].filter(Boolean).join(" / ")).filter(Boolean);
      const drills = of("drill").filter(d => d.status !== "Mastered").map(d => d.name);
      const res = await api.tailorSession({
        place: S.game.place, minutes: S.game.minutes, focus, week: S.game.week, days_to_tournament: S.game.week === "tournament" ? daysOut() : null,
        games: games.map(x => ({ id: x.id, name: x.name, setup: x.setup, score: x.score, target: x.pass[levelOf(S.profile?.handicap)] })),
        player: { handicap: S.profile?.handicap || "", group: S.profile?.grp || "", goals: g.m3 || {}, averages: mine, drills, recent, club_carries: carried(myBag()).map(c => `${c.club} ${c.carry}`) }
      });
      if (sid !== S.sid) return;
      S.game.ai = { ...res, key: sessionKey(games) };
    } catch (err) { toast(err?.message && !/fetch/i.test(err.message) ? err.message : "Couldn't tailor right now. The games still work as they are."); }
    S.game.aiBusy = false; render();
  }
  function go(screen) { if (root.querySelector(".vprog")) { toast("Wait for the video to finish uploading."); return; } if (screen === "plan" && S.screen !== "plan") S.planWeek = null; if (screen === "bag" && S.screen !== "bag") S.bagDraft = draft.get(`${S.sid}.bagdraft`); S.screen = screen; S.liveSetup = null; S.logOpen = false; S.practiceOpen = false; S.sheet = null; render(); window.scrollTo(0, 0); }
  function openScore(entryId, drillId) {
    const p = S.entries.find(e => e.id === entryId);
    const dr = drillById(drillId || p?.drill);
    if (!dr) { S.sheet = null; render(); return; }
    const l = lastScore(dr.id);
    S.sheet = { kind: "score", id: entryId, drill: dr.id, val: l ? l.score : Math.round((+dr.of || 10) / 2) };
    render();
  }
  async function run(fn, ok) {
    try { await fn(); if (ok) toast(ok); await load(); return true; }
    catch (err) { toast(friendly(err)); return false; }
  }

  // ---------- events
  root.onclick = async e => {
    const t = e.target;
    const goBtn = t.closest("[data-go]"); if (goBtn) { go(goBtn.dataset.go); return; }
    if (t.closest("[data-close]")) { S.sheet = null; render(); return; }
    const op = t.closest("[data-open]"); if (op) { S.sheet = { kind: "detail", id: op.dataset.open }; render(); return; }
    const rd = t.closest("[data-round]"); if (rd) { S.sheet = { kind: "round", id: rd.dataset.round }; render(); return; }
    const ss = t.closest("[data-sess]"); if (ss) { S.sheet = { kind: "session", id: ss.dataset.sess }; render(); return; }
    const ar = t.closest("[data-area]");
    if (ar) { const n = ar.dataset.area, A = S.sess.areas; S.sess.areas = A.includes(n) ? A.filter(x => x !== n) : A.concat(n); render(); return; }
    const rt = t.closest("[data-rate]"); if (rt) { const v = +rt.dataset.rate; S.sess.rating = S.sess.rating === v ? 0 : v; render(); return; }
    const lv = t.closest("[data-lv],[data-lvstep],[data-lvgo]"); if (lv && S.live) { liveTap(lv); return; }
    const ls = t.closest("[data-lsholes],[data-lsmode]");
    if (ls && S.liveSetup) { S.liveSetup.course = root.querySelector("#lv-course")?.value || ""; S.liveSetup.date = root.querySelector("#lv-date")?.value || today(); S.liveSetup.event = root.querySelector("#lv-event")?.value || "Casual";
      if (ls.dataset.lsholes) S.liveSetup.holes = ls.dataset.lsholes; else S.liveSetup.mode = ls.dataset.lsmode; render(); return; }
    const gp = t.closest("[data-gplace]"); if (gp) { const pl = gp.dataset.gplace; S.game.place = pl; S.game.seed = 0; S.game.pin = null; if (pl === "course" && S.game.minutes < 60) S.game.minutes = 90; if (pl !== "course" && S.game.minutes > 60) S.game.minutes = 30; render(); return; }
    const pw = t.closest("[data-pweek]"); if (pw) { S.planWeek = addDays(S.planWeek || weekStartOf(), +pw.dataset.pweek); render(); return; }
    const tr = t.closest("[data-trtype],[data-trn],[data-trholes],[data-trmetric]");
    if (tr) { const d = tr.dataset; if (d.trtype) S.trend.type = d.trtype; if (d.trn) S.trend.n = +d.trn; if (d.trholes) S.trend.holes = d.trholes; if (d.trmetric) S.trend.metric = d.trmetric; render(); return; }
    const gw = t.closest("[data-gweek]"); if (gw) { S.game.week = gw.dataset.gweek; S.game.seed = 0; S.game.pin = null; S.game.ai = null; saveWeek(); render(); return; }
    const gm = t.closest("[data-gmin]"); if (gm) { S.game.minutes = +gm.dataset.gmin; S.game.seed = 0; render(); return; }
    const gf = t.closest("[data-gfocus]"); if (gf) { S.game.focus = gf.dataset.gfocus; S.game.seed = 0; S.game.pin = null; render(); return; }
    const dl = t.closest("[data-drill]"); if (dl) { S.sheet = { kind: "drill", id: dl.dataset.drill }; render(); return; }
    const sw = t.closest("[data-switch]"); if (sw) { select(sw.dataset.switch); return; }
    const stp = t.closest("[data-step]");
    if (stp && S.sheet?.kind === "score") {
      const dr = drillById(S.sheet.drill);
      S.sheet.val = Math.max(0, Math.min(+dr.of || 10, S.sheet.val + +stp.dataset.step));
      render(); return;
    }
    const a = t.closest("[data-act]"); if (!a) return;
    const act = a.dataset.act;
    if (act === "menu") { S.sheet = { kind: "menu" }; render(); return; }
    if (act === "signout") { if (stopWatch) stopWatch(); await api.signOut(); document.body.style.overflow = ""; root.onclick = root.onchange = root.onsubmit = root.oninput = null; onSignOut(); return; }
    if (act === "log") { S.screen = "rounds"; S.logOpen = true; S.sheet = null; render(); window.scrollTo(0, 0); return; }
    if (act === "cancel-log") { S.logOpen = false; render(); return; }
    if (act === "practice") { openPractice(); return; }
    if (act === "game-shuffle") { S.game.seed++; S.game.ai = null; S.game.pin = null; render(); window.scrollTo(0, 0); return; }
    if (act === "game-log") { logGames(); return; }
    if (act === "game-ai") { tailor(); return; }
    if (act === "bag-est") {
      const v = +root.querySelector("#bag7").value;
      if (!(v >= 60 && v <= 250)) { toast("Type your 7-iron carry first, e.g. 140."); return; }
      const { bag } = mergeInto(S.bagDraft, estimateFrom7(v), { onlyEmpty: true });
      S.bagDraft = bag; keepBag(); toast("Estimated. Now fix any club you know better, then Save."); render(); return;
    }
    if (act === "bag-add") { S.bagDraft.push({ club: "", carry: "", total: "", on: true }); render(); root.querySelector(".bag-row:last-of-type .bag-name")?.focus(); return; }
    if (act === "live-new") { if (S.live) { toast("Finish or discard your round in progress first."); return; } S.liveSetup = { course: "", date: today(), event: "Casual", holes: "18", mode: "quick" }; S.screen = "live"; S.sheet = null; render(); window.scrollTo(0, 0); return; }
    if (act === "live-start") {
      const st = S.liveSetup; st.course = root.querySelector("#lv-course").value.trim(); st.date = root.querySelector("#lv-date").value || today(); st.event = root.querySelector("#lv-event").value;
      const nums = st.holes === "front" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : st.holes === "back" ? [10, 11, 12, 13, 14, 15, 16, 17, 18] : Array.from({ length: 18 }, (_, i) => i + 1);
      const pars = parsFor(st.course) || {};
      S.live = { course: st.course, date: st.date, event: st.event, mode: st.mode, cur: 0, card: nums.map(n => newHole(n, +pars[n] || 4)) };
      S.liveSetup = null; saveLive(); render(); window.scrollTo(0, 0); return;
    }
    if (act === "live-resume") { S.liveSetup = null; S.screen = "live"; render(); window.scrollTo(0, 0); return; }
    if (act === "live-leave") { S.screen = "rounds"; render(); return; }
    if (act === "live-discard") {
      if (!a.classList.contains("armed")) { a.classList.add("armed"); a.textContent = "Tap again to discard"; setTimeout(() => { a.classList.remove("armed"); a.textContent = "Discard"; }, 3500); return; }
      draft.clear(liveKey()); S.live = null; render(); return;
    }
    if (act === "live-next" || act === "live-prev") {
      const L = S.live, h = L.card[L.cur];
      if (act === "live-next" && h.score == null) { toast("Tap your score for this hole first."); return; }
      L.cur += act === "live-next" ? 1 : -1; saveLive(); render(); window.scrollTo(0, 0); return;
    }
    if (act === "live-finish") { S.live.finishing = true; saveLive(); render(); window.scrollTo(0, 0); return; }
    if (act === "live-back") { S.live.finishing = false; saveLive(); render(); return; }
    if (act === "review-round") { reviewRound(S.sheet.id); return; }
    if (act === "review-game") {
      const g = GAMES.find(x => x.id === a.dataset.game);
      if (g) { S.game = { ...S.game, place: g.place, minutes: g.place === "course" ? 90 : Math.max(30, g.min), pin: g.id, seed: 0, ai: null }; go("games"); }
      return;
    }
    if (act === "cancel-practice") { S.practiceOpen = false; render(); return; }
    if (act === "to-score") { openScore(S.sheet.id); return; }
    if (act === "score-drill") { const id = S.sheet.id; S.sheet = { kind: "score", id, drill: id, val: 0 }; openScore(id, id); return; }
    if (act === "mark-done" || act === "undo-done") {
      const id = S.sheet.id; S.sheet = null;
      await run(() => api.setPlanDone(id, act === "mark-done"), act === "mark-done" ? "Nice work. Karina will see it." : "Marked not done");
      return;
    }
    if (act === "save-score") {
      const { id, drill, val } = S.sheet;
      const dr = drillById(drill), p = S.entries.find(e => e.id === id);
      S.sheet = null; render();
      await run(async () => {
        await api.addScore(S.sid, dr.id, val, +dr.of || 10, today());
        if (p && p.type === "plan" && !p.done) await api.setPlanDone(p.id, true);
      }, dr.goal && val >= +dr.goal ? "Target hit! Karina will see it." : "Score saved. Karina will see it.");
      return;
    }
    if (act === "del-sess") {
      if (!a.classList.contains("armed")) { a.classList.add("armed"); a.textContent = "Tap again to delete"; setTimeout(() => { a.classList.remove("armed"); a.textContent = "Delete"; }, 3500); return; }
      const id = S.sheet.id; S.sheet = null;
      await run(() => api.deleteEntry(id), "Practice deleted");
      return;
    }
    if (act === "del-round") {
      if (!a.classList.contains("armed")) { a.classList.add("armed"); a.textContent = "Tap again to delete"; setTimeout(() => { a.classList.remove("armed"); a.textContent = "Delete round"; }, 3500); return; }
      const id = S.sheet.id; S.sheet = null;
      await run(() => api.deleteEntry(id), "Round deleted");
    }
  };
  root.onchange = async e => {
    if (e.target.id === "bagPhoto") { readBagPhoto(e.target.files[0]); e.target.value = ""; return; }
    if (e.target.dataset?.bagon != null && S.bagDraft) { S.bagDraft[+e.target.dataset.bagon].on = e.target.checked; keepBag(); render(); return; }
    if (e.target.dataset?.lvsel && S.live) { setPath(S.live.card[S.live.cur], e.target.dataset.lvsel, e.target.value); saveLive(); return; }
    const id = e.target.dataset?.task;
    if (!id) return;
    const p = S.entries.find(x => x.id === id);
    const dr = p.drill && drillById(p.drill);
    if (e.target.checked && dr && dr.goal) { e.target.checked = false; openScore(p.id); return; }
    await run(() => api.setPlanDone(id, e.target.checked), e.target.checked ? "Nice work. Karina will see it." : "Marked not done");
  };
  root.onsubmit = async e => {
    e.preventDefault();
    if (e.target.id === "roundForm") {
      const f = k => root.querySelector("#r-" + k).value.trim();
      const num = v => v === "" || isNaN(+v) ? "" : +v;
      if (f("score") === "" || isNaN(+f("score"))) { toast("Add your score to save the round."); root.querySelector("#r-score").focus(); return; }
      const d = { date: f("date") || today(), event: f("event"), course: f("course"), holes: f("holes"), score: +f("score"), putts: num(f("putts")), fairways: f("fw"), gir: num(f("gir")), updown: f("ud"), penalties: num(f("pen")), threeputts: num(f("3p")), doubles: num(f("dbl")), notes: f("notes") };
      let saved = null;
      const ok = await run(async () => { saved = await api.addEntry(S.sid, "stat", d); }, "Round saved");
      if (ok) {
        clearDrafts("roundForm"); S.logOpen = false;
        if (saved && S.aiAvailable) { S.sheet = { kind: "round", id: saved.id }; render(); reviewRound(saved.id); }
        else render();
      }
    }
    if (e.target.id === "liveForm") { await liveSave(); return; }
    if (e.target.id === "bagForm") {
      const clubs = sortBag(S.bagDraft.filter(c => c.club.trim()).map(c => ({ club: c.club.trim(), carry: c.carry, total: c.total, on: c.on !== false })));
      if (!clubs.some(c => +c.carry > 0)) { toast("Add at least one carry distance."); return; }
      const e0 = bagEntry();
      const ok = await run(() => e0 ? api.updateEntry(e0, { clubs }) : api.addEntry(S.sid, "bag", { clubs }), "Bag saved");
      if (ok) { draft.clear(`${S.sid}.bagdraft`); S.bagDraft = null; render(); }
      return;
    }
    if (e.target.id === "practiceForm") {
      const f = k => root.querySelector("#p-" + k).value.trim();
      const d = { date: f("date") || today(), minutes: f("min") === "" || isNaN(+f("min")) ? "" : +f("min"), areas: S.sess.areas, ...(S.sess.games ? { games: S.sess.games } : {}), ...(S.sess.week && S.sess.week !== "normal" ? { week: S.sess.week } : {}), rating: S.sess.rating || "", worked: f("worked"), went: f("went"), next: f("next") };
      if (!d.worked && !d.went && !d.areas.length && d.minutes === "") { toast("Add what you practiced first."); return; }
      const ok = await run(() => api.addEntry(S.sid, "session", d), "Practice saved. Karina will see it.");
      if (ok) { clearDrafts("practiceForm"); S.practiceOpen = false; S.sess = { areas: [], rating: 0 }; render(); }
    }
    if (e.target.id === "goalForm") {
      const g = goal();
      const d = {};
      GOAL_PERIODS.forEach(([pk]) => { d[pk] = {}; GOAL_FIELDS.forEach(f => { d[pk][f.k] = root.querySelector(`#g-${pk}-${f.k}`).value.trim(); }); });
      if (!GOAL_PERIODS.some(([pk]) => GOAL_FIELDS.some(f => d[pk][f.k]))) { toast("Write at least one goal first."); return; }
      const ok = await run(() => g ? api.updateEntry(g, d) : api.addEntry(S.sid, "goal", d), "Goals saved. Karina will see them.");
      if (ok) { clearDrafts("goalForm"); S.goalDraft = {}; render(); }
    }
    if (e.target.id === "noteForm") {
      const text = root.querySelector("#note").value.trim();
      if (noteVideo?.busy) { toast("Wait for the video to finish uploading."); return; }
      const video_pid = noteVideo?.value || "";
      if (!text && !video_pid) { toast("Write a note or attach a video first."); return; }
      root.querySelector("#note").value = "";
      if (noteVideo) noteVideo.value = "";
      const sid = S.sid;
      draft.clear(`${sid}.note`);
      const ok = await run(() => api.addEntry(sid, "note", video_pid ? { text, video_pid } : { text }), video_pid ? "Video sent to Karina" : "Sent to Karina");
      if (!ok) { draft.set(`${sid}.note`, text); const el = root.querySelector("#note"); if (el) el.value = text; if (noteVideo && video_pid) noteVideo.value = video_pid; }
    }
  };

  root.oninput = e => {
    const id = e.target.id || "";
    if (id.startsWith("g-")) S.goalDraft[id] = e.target.value;
    if (e.target.dataset?.bag && S.bagDraft) { const [i, k] = e.target.dataset.bag.split("."); S.bagDraft[+i][k] = k === "club" ? e.target.value : e.target.value.replace(/[^0-9]/g, ""); keepBag(); }
    if (e.target.dataset?.lvin && S.live) {
      setPath(S.live.card[S.live.cur], e.target.dataset.lvin, e.target.value.replace(/[^0-9]/g, "")); saveLive();
      // Update the club hint in place: re-rendering here would swallow the next tap.
      if (e.target.dataset.lvin === "app.yds") { const hn = document.getElementById("bagHint"); if (hn) hn.textContent = bagHint(e.target.value); }
    }
    if (id === "lv-notes" && S.live) { S.live.notes = e.target.value; saveLive(); }
    if (id === "g-tdate") { S.game.tdate = e.target.value; S.game.seed = 0; saveWeek(); render(); }
    if (id && e.target.matches(DRAFTABLE)) draft.set(`${S.sid}.${id}`, e.target.value);
    if (id === "calc") {
      const v = +e.target.value;
      if (v >= 60 && v <= 130) { S.calc = v; const out = document.getElementById("benchOut"); if (out) out.innerHTML = benchmarkTable(v, myAverages(of("stat")), esc); }
    }
  };

  bindPlayer(root);
  api.touchSeen();
  api.tailorAvailable().then(v => { S.aiAvailable = v; if (S.screen === "games") render(); }).catch(() => { S.aiAvailable = false; });
  select(S.sid);
}
