import "./student.css";
import { api } from "../lib/store.js";
import { DAYS, esc, initials, today, todayIndex, dateParts, fmtDate, shortDate, safeUrl, areaChip, focusBar, toast, friendly } from "../lib/util.js";

const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  rounds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21V3l10 4-10 4"/><ellipse cx="12" cy="21" rx="7" ry="1.2"/></svg>',
  lessons: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>'
};
const PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>';
const LOCK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';

export function start(root, { students, onSignOut }) {
  const S = {
    students, sid: null, profile: null, entries: [], scores: [],
    screen: "home", sheet: null, logOpen: false, loading: true
  };
  try { const saved = localStorage.getItem("sph.student"); if (students.some(s => s.id === saved)) S.sid = saved; } catch {}
  if (!S.sid) S.sid = students[0].id;

  let stopWatch = null, reloadTimer = null;

  // ---------- data
  async function load() {
    try {
      const [profile, entries, scores] = await Promise.all([api.studentProfile(S.sid), api.entries(S.sid), api.scores(S.sid)]);
      S.profile = profile; S.entries = entries; S.scores = scores; S.loading = false;
      render();
    } catch (err) { S.loading = false; render(); toast(friendly(err)); }
  }
  function select(id) {
    S.sid = id; S.loading = true; S.sheet = null; S.screen = "home";
    try { localStorage.setItem("sph.student", id); } catch {}
    if (stopWatch) stopWatch();
    stopWatch = api.watch([id], () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(load, 400); });
    render(); load();
  }

  const of = t => S.entries.filter(e => e.type === t);
  const drillById = id => S.entries.find(e => e.id === id && e.type === "drill");
  const scoresFor = id => S.scores.filter(s => s.drill_id === id).sort((a, b) => (a.scored_on + a.created_at).localeCompare(b.scored_on + b.created_at));
  const lastScore = id => { const a = scoresFor(id); return a[a.length - 1] || null; };
  const plan = () => of("plan").slice().sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
  const mins = () => {
    const p = of("plan");
    const planned = p.reduce((a, x) => a + (+x.minutes || 0), 0);
    const done = p.filter(x => x.done).reduce((a, x) => a + (+x.minutes || 0), 0);
    return { planned, done, pct: planned ? Math.round(done / planned * 100) : 0 };
  };
  const byDateDesc = a => a.slice().sort((x, y) => String(y.date || y.created_at).localeCompare(String(x.date || x.created_at)));
  const firstName = () => String(S.profile?.name || "").split(/\s+/)[0];

  // ---------- pieces
  function top(title, sub) {
    return `<header class="s-top"><div><div class="hello">${esc(sub)}</div><h1>${esc(title)}</h1></div>
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
    const m = mins(), ti = todayIndex(), p = plan();
    const todays = p.filter(x => x.day === DAYS[ti]);
    const lesson = byDateDesc(of("lesson")).find(l => l.homework);
    const rounds = of("stat").filter(r => String(r.holes || "18") === "18" && r.score !== "" && r.score != null);
    const recent = byDateDesc(rounds).slice(0, 3);
    const avg = recent.length ? (recent.reduce((a, r) => a + +r.score, 0) / recent.length).toFixed(1) : null;
    const dateLine = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    return top(`Hi, ${firstName()}`, dateLine) + `<main class="s-content">
      <section class="card week-card"><h2>This week's practice</h2>
        <div class="big-n">${m.done}<small> / ${m.planned} min</small></div>
        <div class="bar"><i style="width:${m.pct}%"></i></div>
        <div class="dots">${DAYS.map((d, i) => { const b = p.filter(x => x.day === d); const on = b.length && b.every(x => x.done); return `<div class="${on ? "on" : ""} ${i === ti ? "today" : ""} ${b.length ? "" : "rest"}"><b>${on ? "✓" : ""}</b>${d}</div>`; }).join("")}</div>
      </section>
      <section class="card"><h2>Today <span>${todays.reduce((a, x) => a + (+x.minutes || 0), 0) || ""}${todays.length ? " min" : ""}</span></h2>
        ${todays.map(task).join("") || `<p class="muted">Nothing planned today. Rest, or get ahead on tomorrow.</p>`}</section>
      ${lesson ? `<section class="card"><h2>Homework from Karina</h2><div class="hw">${esc(lesson.homework)}<div class="from">From your ${esc(shortDate(lesson.date))} lesson${lesson.focus ? " · " + esc(lesson.focus) : ""}</div></div></section>` : ""}
      ${S.profile?.next_lesson || S.profile?.goals ? `<section class="card"><h2>Your season</h2>
        ${S.profile.next_lesson ? `<div class="goal-row"><div><div class="l">Next lesson</div><div class="v">${esc(fmtDate(S.profile.next_lesson).replace(/, \d{4}$/, ""))}</div></div>${avg ? `<div style="text-align:right"><div class="l">Avg of last ${recent.length}</div><div class="v">${avg}</div></div>` : ""}</div>` : ""}
        ${S.profile.goals ? `<p style="margin:0;font-size:14px;white-space:pre-wrap"><b>Goal:</b> ${esc(S.profile.goals)}</p>` : ""}</section>` : ""}
      <div class="row2"><button class="btn primary" data-act="log">Log a round</button><button class="btn" data-go="notes">Message Karina</button></div>
    </main>`;
  }
  function planScreen() {
    const m = mins(), p = plan(), ti = todayIndex();
    if (!p.length) return top("This week", S.profile?.name || "") + `<main class="s-content"><div class="card"><p class="muted">Karina hasn't set this week's plan yet.</p></div></main>`;
    return top("This week", S.profile?.name || "") + `<main class="s-content">
      <section class="card"><h2>Progress <span>${m.done} of ${m.planned} min · ${m.pct}%</span></h2><div class="bar plain"><i style="width:${m.pct}%"></i></div></section>
      <section class="card"><h2>What you're working on</h2>${focusBar(p, x => x.minutes, x => x.area)}</section>
      ${DAYS.map((d, i) => { const b = p.filter(x => x.day === d); if (!b.length) return ""; return `<section class="card"><h2>${d}${i === ti ? " · today" : ""} <span>${b.reduce((a, x) => a + (+x.minutes || 0), 0)} min</span></h2>${b.map(task).join("")}</section>`; }).join("")}
      <p class="muted" style="text-align:center">Karina sets your plan. Days not shown are rest days.</p></main>`;
  }
  function roundsScreen() {
    const r = byDateDesc(of("stat"));
    const e18 = r.filter(x => String(x.holes || "18") === "18");
    const avg = k => { const v = e18.filter(x => x[k] !== "" && x[k] != null && !isNaN(+x[k])).map(x => +x[k]); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–"; };
    return top("My rounds", S.profile?.name || "") + `<main class="s-content">
      <div class="stats"><div><b>${avg("score")}</b><small>Avg score (18)</small></div><div><b>${avg("putts")}</b><small>Avg putts</small></div><div><b>${avg("gir")}</b><small>Avg greens</small></div></div>
      ${S.logOpen ? logForm() : `<button class="btn primary" data-act="log">+ Log a round</button>`}
      <section class="card"><h2>Recent rounds</h2>${r.map(x => { const d = dateParts(x.date); return `<button class="round" data-round="${esc(x.id)}"><span class="date"><b>${d.d}</b><small>${esc(d.mon || "")}</small></span>
        <span><span style="font-weight:600;display:block">${esc(x.course || x.event || "Round")}</span><span class="meta">${esc(x.event || "")} · ${esc(x.holes || "18")} holes${x.putts !== "" && x.putts != null ? ` · ${esc(x.putts)} putts` : ""}${x.fairways ? ` · FW ${esc(x.fairways)}` : ""}</span></span>
        <span class="sc">${esc(x.score)}</span></button>`; }).join("") || `<p class="muted">No rounds yet. Log your next one after you play.</p>`}</section></main>`;
  }
  function logForm() {
    return `<form class="card" id="roundForm" novalidate><h2>Log a round</h2>
      <div class="row2"><div class="field"><label for="r-date">Date</label><input id="r-date" type="date" value="${today()}"></div>
      <div class="field"><label for="r-event">Type</label><select id="r-event"><option>Casual</option><option>Practice round</option><option>Tournament</option></select></div></div>
      <div class="row2"><div class="field"><label for="r-course">Course</label><input id="r-course" autocomplete="off"></div>
      <div class="field"><label for="r-holes">Holes</label><select id="r-holes"><option>18</option><option>9</option></select></div></div>
      <div class="row2"><div class="field"><label for="r-score">Score *</label><input id="r-score" inputmode="numeric"></div><div class="field"><label for="r-putts">Putts</label><input id="r-putts" inputmode="numeric"></div></div>
      <div class="row2"><div class="field"><label for="r-fw">Fairways (e.g. 8/14)</label><input id="r-fw"></div><div class="field"><label for="r-gir">Greens in regulation</label><input id="r-gir" inputmode="numeric"></div></div>
      <div class="field"><label for="r-notes">Note for Karina</label><textarea id="r-notes" placeholder="What went well, what didn't"></textarea></div>
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
      ${lessons.map(l => `<section class="card lesson"><div class="dt">${esc(fmtDate(l.date))}${l.kind ? " · " + esc(l.kind) : ""}</div><div class="t">${esc(l.focus)}</div>${l.notes ? `<p>${esc(l.notes)}</p>` : ""}${l.homework ? `<div class="hw"><b>Homework:</b> ${esc(l.homework)}</div>` : ""}${demoLink(l.video, "Watch lesson video")}</section>`).join("")}
      ${fit.length ? `<section class="card"><h2>Fitness</h2>${fit.map(f => `<div class="drill" style="cursor:default"><span><span class="t" style="display:block">${esc(f.name)}${f.dose ? ` <span class="tg">· ${esc(f.dose)}</span>` : ""}</span><span class="tg">${esc(f.kind || "")}${f.notes ? " · " + esc(f.notes) : ""}</span></span>${f.result && f.result !== "—" ? `<span class="pill ${f.result === "Pass" ? "good" : f.result === "Fail" ? "bad" : f.result === "Needs work" ? "warn" : "n"}">${esc(f.result)}</span>` : ""}</div>`).join("")}</section>` : ""}
      ${!lessons.length && !drills.length && !fit.length ? `<div class="card"><p class="muted">Karina's lesson notes and drills will show up here.</p></div>` : ""}
    </main>`;
  }
  function notesScreen() {
    const notes = of("note").slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    return top("Notes", S.profile?.name || "") + `<main class="s-content">
      <section class="card"><h2>With Karina</h2><div class="thread">${notes.map(n => `<div class="msg ${n.author === "coach" ? "coach" : "me"}">${esc(n.text)}<small>${n.author === "coach" ? "Karina" : "You"} · ${esc(shortDate(n.created_at))}</small></div>`).join("") || `<p class="muted">No notes yet. Ask a question or tell Karina how practice went.</p>`}</div></section>
      <form class="card" id="noteForm" novalidate><label for="note" style="font-size:12px;font-weight:600;color:var(--ink-2)">New note or question</label><textarea id="note" placeholder="How practice went, or a question for your next lesson"></textarea><button class="btn primary" type="submit">Send to Karina</button></form>
    </main>`;
  }
  function nav() {
    const items = [["home", "Home"], ["plan", "Plan"], ["rounds", "Rounds"], ["lessons", "Lessons"], ["notes", "Notes"]];
    return `<nav class="nav" aria-label="Sections"><div>${items.map(([k, l]) => `<button data-go="${k}" ${S.screen === k ? 'aria-current="page"' : ""}>${ICON[k]}${l}</button>`).join("")}</div></nav>`;
  }

  // ---------- sheets
  function sheetHtml() {
    const sh = S.sheet;
    if (!sh) return "";
    const wrap = (label, inner) => `<div class="sheet-bg" data-close="1"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="grab"></div>${inner}</div>`;
    if (sh.kind === "menu") {
      return wrap("Account", `<h2>${esc(S.profile?.name || "")}</h2>
        ${S.students.length > 1 ? `<p>Switch player</p>${S.students.map(s => `<button class="menu-item" data-switch="${esc(s.id)}" aria-current="${s.id === S.sid}">${esc(s.name)}<span>${s.id === S.sid ? "✓" : "›"}</span></button>`).join("")}` : ""}
        <p>Tip: add this app to your home screen. On iPhone, tap Share, then "Add to Home Screen".</p>
        <button class="btn" data-act="signout">Sign out</button><button class="btn" data-close="1">Close</button>`);
    }
    if (sh.kind === "round") {
      const r = S.entries.find(e => e.id === sh.id);
      if (!r) return "";
      return wrap("Round", `<h2>${esc(r.score)} at ${esc(r.course || "the course")}</h2>
        <p>${esc(fmtDate(r.date))} · ${esc(r.event || "")} · ${esc(r.holes || "18")} holes</p>
        <div class="stats"><div><b>${esc(r.putts ?? "–") || "–"}</b><small>Putts</small></div><div><b>${esc(r.fairways || "–")}</b><small>Fairways</small></div><div><b>${esc(r.gir ?? "–") || "–"}</b><small>Greens</small></div></div>
        ${r.notes ? `<p>${esc(r.notes)}</p>` : ""}
        ${r.author === "student" ? `<button class="btn danger" data-act="del-round">Delete round</button>` : ""}<button class="btn" data-close="1">Close</button>`);
    }
    if (sh.kind === "drill") {
      const dr = drillById(sh.id);
      if (!dr) return "";
      return wrap(dr.name, `${areaChip(dr.category)}<h2>${esc(dr.name)}</h2>${dr.notes ? `<p>${esc(dr.notes)}</p>` : ""}
        ${demoLink(dr.video, "Watch Karina's demo")}
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
      ${dr ? demoLink(dr.video, "Watch Karina's demo") : demoLink(p.video, "Watch the demo")}
      ${dr && dr.goal ? `<div class="target"><b>${esc(dr.goal)}/${esc(dr.of || 10)}</b><span>Target${dr.target ? ": " + esc(dr.target) : ""}</span></div>
        <div><h3 style="margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3)">Your scores</h3>${hist(dr)}</div>`
        : `<div class="target"><b>${esc(p.minutes || "–")}</b><span>minutes · ${esc(p.day || "")}</span></div>`}
      ${p.done ? `<button class="btn" data-act="undo-done">Mark not done</button><button class="btn" data-close="1">Close</button>`
        : `<button class="btn primary" data-act="${dr && dr.goal ? "to-score" : "mark-done"}">${dr && dr.goal ? "Log my score" : "Mark done"}</button>`}`);
  }

  // ---------- render
  function render() {
    if (S.loading && !S.profile) {
      root.innerHTML = `<div class="center-msg"><div><p>Loading your practice…</p></div></div>`;
      return;
    }
    const scr = { home, plan: planScreen, rounds: roundsScreen, lessons: lessonsScreen, notes: notesScreen }[S.screen]();
    const y = window.scrollY;
    root.innerHTML = `<div class="s-app">${scr}</div>${nav()}${sheetHtml()}`;
    window.scrollTo(0, y);
    document.body.style.overflow = S.sheet ? "hidden" : "";
  }
  function go(screen) { S.screen = screen; S.logOpen = false; S.sheet = null; render(); window.scrollTo(0, 0); }
  function openScore(entryId, drillId) {
    const p = S.entries.find(e => e.id === entryId);
    const dr = drillById(drillId || p?.drill);
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
    if (act === "signout") { if (stopWatch) stopWatch(); await api.signOut(); document.body.style.overflow = ""; root.onclick = root.onchange = root.onsubmit = null; onSignOut(); return; }
    if (act === "log") { S.screen = "rounds"; S.logOpen = true; S.sheet = null; render(); window.scrollTo(0, 0); return; }
    if (act === "cancel-log") { S.logOpen = false; render(); return; }
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
    if (act === "del-round") {
      if (!a.classList.contains("armed")) { a.classList.add("armed"); a.textContent = "Tap again to delete"; setTimeout(() => { a.classList.remove("armed"); a.textContent = "Delete round"; }, 3500); return; }
      const id = S.sheet.id; S.sheet = null;
      await run(() => api.deleteEntry(id), "Round deleted");
    }
  };
  root.onchange = async e => {
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
      const d = { date: f("date") || today(), event: f("event"), course: f("course"), holes: f("holes"), score: +f("score"), putts: num(f("putts")), fairways: f("fw"), gir: num(f("gir")), notes: f("notes") };
      const ok = await run(() => api.addEntry(S.sid, "stat", d), "Round saved");
      if (ok) { S.logOpen = false; render(); }
    }
    if (e.target.id === "noteForm") {
      const text = root.querySelector("#note").value.trim();
      if (!text) { toast("Write your note first."); return; }
      await run(() => api.addEntry(S.sid, "note", { text }), "Sent to Karina");
    }
  };

  api.touchSeen();
  select(S.sid);
}
