import "./coach.css";
import { api } from "../lib/store.js";
import { videoThumb, videoField, bindPlayer } from "../lib/video.js";
import { DAYS, AREA_NAMES, esc, initials, today, dateParts, fmtDate, shortDate, ago, safeUrl, areaChip, focusBar, toast, friendly } from "../lib/util.js";

const STUDENT_FIELDS = [
  { k: "name", t: "text", l: "Full name", req: true, full: true },
  { k: "grp", t: "select", l: "Group", opts: ["Adult", "Junior"] },
  { k: "program", t: "select", l: "Program", opts: ["Private lessons", "Group clinic", "Lesson package", "Club fitting only"] },
  { k: "email", t: "email", l: "Student's sign-in email", full: true, ph: "For adults and older juniors" },
  { k: "guardian_email", t: "email", l: "Parent's sign-in email", full: true, ph: "For juniors. The parent signs in with this." },
  { k: "handicap", t: "text", l: "Handicap index", ph: "e.g. 14.2" },
  { k: "start_date", t: "date", l: "Started with me" },
  { k: "next_lesson", t: "date", l: "Next lesson" },
  { k: "goals", t: "textarea", l: "Season goals (student sees this)", full: true, ph: "Break 90, make the high school team, etc." },
  { k: "coach_notes", t: "textarea", l: "Coach notes (only you see this)", full: true, ph: "Swing tendencies, injuries to work around" }
];

const TYPES = {
  lesson: { tab: "Lessons", one: "Lesson", sub: "Every session, what you covered, and the homework. Students see these.", fields: [
    { k: "date", t: "date", l: "Date", req: true },
    { k: "kind", t: "select", l: "Type", opts: ["Private lesson", "Group clinic", "Playing lesson", "Club fitting", "Video review"] },
    { k: "focus", t: "text", l: "Focus", req: true, full: true, ph: "e.g. Early extension, driver face control" },
    { k: "notes", t: "textarea", l: "What we worked on", full: true },
    { k: "homework", t: "textarea", l: "Homework", full: true },
    { k: "video_pid", t: "video", l: "Lesson video", full: true },
    { k: "video", t: "url", l: "Or paste a video link (YouTube, Google Drive)", full: true, ph: "https://" }
  ] },
  drill: { tab: "Drills", one: "Drill", sub: "Drills with a pass target. Students log scores against the target.", fields: [
    { k: "name", t: "text", l: "Drill name", req: true, full: true },
    { k: "category", t: "select", l: "Part of the game", opts: AREA_NAMES },
    { k: "status", t: "select", l: "Status", opts: ["Assigned", "In progress", "Mastered"] },
    { k: "goal", t: "number", l: "Target score", ph: "e.g. 8" },
    { k: "of", t: "number", l: "Out of", ph: "e.g. 10" },
    { k: "target", t: "text", l: "What counts", full: true, ph: "e.g. putts finish within a club length past the hole" },
    { k: "notes", t: "textarea", l: "How to do it", full: true },
    { k: "video_pid", t: "video", l: "Demo video", full: true },
    { k: "video", t: "url", l: "Or paste a video link", full: true, ph: "https://" }
  ] },
  stat: { tab: "Stats", one: "Round", sub: "Rounds logged by you or the student. The chart tracks 18-hole scores.", fields: [
    { k: "date", t: "date", l: "Date", req: true },
    { k: "event", t: "select", l: "Round type", opts: ["Casual", "Practice round", "Tournament", "Playing lesson"] },
    { k: "course", t: "text", l: "Course", full: true },
    { k: "holes", t: "select", l: "Holes", opts: ["18", "9"] },
    { k: "score", t: "number", l: "Score", req: true },
    { k: "fairways", t: "text", l: "Fairways hit", ph: "e.g. 8/14" },
    { k: "gir", t: "number", l: "Greens in regulation" },
    { k: "putts", t: "number", l: "Putts" },
    { k: "updown", t: "text", l: "Up & downs", ph: "e.g. 3/7" },
    { k: "penalties", t: "number", l: "Penalty strokes" },
    { k: "notes", t: "textarea", l: "Notes", full: true }
  ] },
  plan: { tab: "Practice Plan", one: "Practice block", sub: "This week's plan. Students tick blocks off; drill blocks ask them for a score.", fields: [
    { k: "day", t: "select", l: "Day", opts: DAYS, req: true },
    { k: "minutes", t: "number", l: "Minutes" },
    { k: "area", t: "select", l: "Part of the game", opts: AREA_NAMES },
    { k: "drill", t: "drill", l: "Linked drill (asks for a score)" },
    { k: "title", t: "text", l: "Block", req: true, full: true, ph: "e.g. Putting ladder" },
    { k: "details", t: "textarea", l: "Details", full: true },
    { k: "done", t: "check", l: "Done" }
  ] },
  fitness: { tab: "Fitness", one: "Fitness item", sub: "TPI screen results and the exercises assigned from them.", fields: [
    { k: "date", t: "date", l: "Date", req: true },
    { k: "kind", t: "select", l: "Type", opts: ["TPI screen", "Exercise"] },
    { k: "name", t: "text", l: "Test or exercise", req: true, full: true, ph: "e.g. Pelvic rotation, Dead bug" },
    { k: "result", t: "select", l: "Result", opts: ["Pass", "Needs work", "Fail", "Assigned", "—"] },
    { k: "dose", t: "text", l: "Sets / reps", ph: "e.g. 3 x 10" },
    { k: "notes", t: "textarea", l: "Notes", full: true },
    { k: "video_pid", t: "video", l: "Demo video", full: true },
    { k: "video", t: "url", l: "Or paste a video link", full: true, ph: "https://" }
  ] }
};
const TAB_ORDER = ["overview", "lesson", "drill", "stat", "plan", "fitness", "note"];

export function start(root, { onSignOut }) {
  const S = {
    students: [], sel: null, view: "checkin", tab: "overview", filter: "All", q: "", showArchived: false,
    entries: [], scores: [], seen: {}, week: { plans: [], notes: [], scores: [], drills: [] }, invite: null
  };
  let stopWatch = null, reloadTimer = null;

  // ---------- data
  async function loadStudents() {
    const [students, seen] = await Promise.all([api.listStudents(), api.lastSeen().catch(() => [])]);
    S.students = students;
    S.seen = Object.fromEntries(seen.map(r => [r.student_id, r.last_seen]));
  }
  async function loadStudent() {
    if (!S.sel) return;
    const [entries, scores] = await Promise.all([api.entries(S.sel), api.scores(S.sel)]);
    S.entries = entries; S.scores = scores;
  }
  async function loadWeek() {
    const [plans, notes, drills, scores] = await Promise.all([api.entriesOfType("plan"), api.entriesOfType("note"), api.entriesOfType("drill"), api.scores()]);
    S.week = { plans, notes, drills, scores };
  }
  async function refresh() {
    try {
      await loadStudents();
      if (S.view === "student") await loadStudent(); else await loadWeek();
      render();
    } catch (err) { toast(friendly(err)); }
  }
  const soon = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(refresh, 500); };
  async function write(p, ok) {
    try { const r = await p; if (ok) toast(ok); await refresh(); return r ?? true; }
    catch (err) { toast(friendly(err)); return false; }
  }

  // ---------- roster
  function rosterHtml() {
    const q = S.q.toLowerCase();
    const rows = S.students
      .filter(s => S.showArchived || !s.archived)
      .filter(s => S.filter === "All" || s.grp === S.filter)
      .filter(s => !q || String(s.name).toLowerCase().includes(q));
    const unread = unreadCount();
    return `<aside class="roster" aria-label="Students">
      <div class="brand"><span class="eyebrow">Karina Sánchez Golf</span><h1>Student Practice Hub</h1></div>
      <button class="nav-btn" data-view="checkin" aria-current="${S.view === "checkin"}">This week's check-in ${unread ? `<span class="badge" title="New notes from students">${unread}</span>` : ""}</button>
      <input id="search" class="search" type="search" placeholder="Search students" aria-label="Search students" value="${esc(S.q)}">
      <div class="filters" role="group" aria-label="Filter">${["All", "Junior", "Adult"].map(f => `<button class="chip" data-filter="${f}" aria-pressed="${S.filter === f}">${f === "All" ? "All" : f + "s"}</button>`).join("")}</div>
      <ul class="student-list">${!S.students.length ? `<li class="empty-roster">No students yet. Add your first one below.</li>` : !rows.length ? `<li class="empty-roster">No students match.</li>` :
        rows.map(s => `<li><button class="student-btn" data-sid="${esc(s.id)}" aria-current="${S.view === "student" && s.id === S.sel}">
          <span class="avatar ${s.grp === "Junior" ? "junior" : ""}">${esc(initials(s.name))}</span>
          <span><span class="s-name">${esc(s.name)}</span><br><span class="s-meta">${s.archived ? `<span class="archived">Archived</span>` : esc(s.grp || "")}${s.program ? " · " + esc(s.program) : ""}</span></span>
          <span class="hcp">${esc(s.handicap || "")}</span></button></li>`).join("")}</ul>
      <button class="btn primary" data-act="add-student">+ Add student</button>
      <div class="roster-foot"><button data-act="toggle-archived">${S.showArchived ? "Hide archived" : "Show archived"}</button><button data-act="signout">Sign out</button></div>
    </aside>`;
  }
  function unreadCount() {
    const since = Date.now() - 7 * 864e5;
    return S.week.notes.filter(n => n.author === "student" && new Date(n.created_at).getTime() > since).length;
  }

  // ---------- check-in (all students, this week)
  function checkinHtml() {
    const active = S.students.filter(s => !s.archived);
    const since = Date.now() - 7 * 864e5;
    const rows = active.map(s => {
      const plans = S.week.plans.filter(p => p.student_id === s.id);
      const planned = plans.reduce((a, p) => a + (+p.minutes || 0), 0);
      const done = plans.filter(p => p.done).reduce((a, p) => a + (+p.minutes || 0), 0);
      const pct = planned ? Math.round(done / planned * 100) : null;
      const st = pct == null ? "none" : pct >= 80 ? "good" : pct >= 40 ? "warn" : "bad";
      const sc = S.week.scores.filter(x => x.student_id === s.id).sort((a, b) => (a.scored_on + a.created_at).localeCompare(b.scored_on + b.created_at));
      const last = sc[sc.length - 1];
      let drl = "No drill scores yet";
      if (last) {
        const d = S.week.drills.find(x => x.id === last.drill_id);
        const prev = sc.filter(x => x.drill_id === last.drill_id).slice(-2, -1)[0];
        drl = `${d ? d.name : "Drill"} ${last.score}/${last.out_of}` + (prev ? (last.score > prev.score ? `, up from ${prev.score}` : last.score < prev.score ? `, down from ${prev.score}` : ", same as last time") : "") + ` · ${shortDate(last.scored_on)}`;
      }
      const notes = S.week.notes.filter(n => n.student_id === s.id && n.author === "student" && new Date(n.created_at).getTime() > since);
      return { s, planned, done, pct, st, drl, notes, seen: S.seen[s.id] };
    });
    const order = { bad: 0, warn: 1, none: 2, good: 3 };
    rows.sort((a, b) => order[a.st] - order[b.st] || (a.pct ?? 0) - (b.pct ?? 0));
    const c = k => rows.filter(r => r.st === k).length;
    const col = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", none: "var(--line)" };
    return `<section class="checkin">
      <div class="panel-head"><div><h3>This week's check-in</h3><p>Practice minutes against each plan, sorted by who needs you most.</p></div>
        <div class="tally"><span class="st-good">${c("good")} on track</span><span class="st-warn">${c("warn")} behind</span><span class="st-bad">${c("bad")} need a nudge</span>${c("none") ? `<span class="st-none">${c("none")} no plan</span>` : ""}</div></div>
      ${rows.length ? `<div class="crows">${rows.map(r => `<div class="crow"><span class="stripe" style="background:${col[r.st]}"></span>
        <div><button class="nm" data-sid="${esc(r.s.id)}">${esc(r.s.name)}</button><div class="sub">${esc(r.s.grp)} · opened ${r.seen ? ago(r.seen) : "never"}</div>
          ${r.notes.length ? `<div class="newnote">${r.notes.length} new note${r.notes.length > 1 ? "s" : ""}</div>` : ""}</div>
        <div class="prog">${r.pct == null ? `<div class="sub">No practice plan this week</div>` : `<div class="mins"><span>${r.done} of ${r.planned} min</span><span>${r.pct}%</span></div><div class="track"><i style="width:${Math.min(100, r.pct)}%;background:${col[r.st]}"></i></div>`}</div>
        <div class="drl drl-col">${esc(r.drl)}</div>
        <div class="act">${r.st === "good" ? `<span class="pill good">On track</span>` : `<button class="btn small" data-remind="${esc(r.s.id)}">Copy reminder</button>`}</div></div>`).join("")}</div>`
        : `<div class="empty">Add your first student to start tracking practice.</div>`}
      <p style="font-size:12px;color:var(--ink-3);margin:0">"Copy reminder" copies a friendly text with their plan, ready to paste into a message. Use "Start new week" on each student's Practice Plan tab to reset ticks.</p>
    </section>`;
  }
  function reminderText(s) {
    const plans = S.week.plans.filter(p => p.student_id === s.id && !p.done).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    const first = String(s.name).split(/\s+/)[0];
    const lines = plans.slice(0, 5).map(p => `• ${p.day}: ${p.title}${p.minutes ? ` (${p.minutes} min)` : ""}`).join("\n");
    return `Hi ${first}! Quick nudge from Karina. Here's what's left on your practice plan this week:\n${lines || "• Check the app for this week's plan"}\n\nTick things off in the Practice Hub as you go so I can see how it's going before our next lesson.`;
  }

  // ---------- student space
  const of = t => S.entries.filter(e => e.type === t);
  const sortDateDesc = a => a.slice().sort((x, y) => String(y.date || y.created_at || "").localeCompare(String(x.date || x.created_at || "")));
  const scoresFor = id => S.scores.filter(s => s.drill_id === id).sort((a, b) => (a.scored_on + a.created_at).localeCompare(b.scored_on + b.created_at));

  function studentHtml() {
    const s = S.students.find(x => x.id === S.sel);
    if (!s) return `<section class="welcome"><h2>Pick a student</h2><p>Choose someone from the list, or add a new student.</p></section>`;
    const counts = {};
    TAB_ORDER.forEach(t => counts[t] = t === "overview" ? "" : of(t).length);
    const logins = [s.email, s.guardian_email].filter(Boolean);
    return `<button class="btn small ghost back" data-view="checkin">← Back</button>
      <section class="hero">
        <span class="avatar ${s.grp === "Junior" ? "junior" : ""}">${esc(initials(s.name))}</span>
        <div><h2>${esc(s.name)}</h2>
          <div class="sub">${s.archived ? `<span class="tag" style="color:var(--warn)">Archived</span>` : ""}<span class="tag">${esc(s.grp)}</span>${s.program ? `<span class="tag">${esc(s.program)}</span>` : ""}
          ${s.handicap ? `<span>Handicap <b class="hcp">${esc(s.handicap)}</b></span>` : ""}${s.next_lesson ? `<span>Next lesson ${esc(shortDate(s.next_lesson))}</span>` : ""}</div>
          <div class="logins">${logins.length ? `Signs in with ${logins.map(esc).join(" or ")} · opened the app ${S.seen[s.id] ? ago(S.seen[s.id]) : "never"}` : "No sign-in email yet. Add one in Edit profile so they can use the app."}</div></div>
        <div class="hero-actions">${logins.length && !s.archived ? `<button class="btn small" data-act="invite">Invite</button>` : ""}<button class="btn small" data-act="edit-student">Edit profile</button></div>
      </section>
      ${S.invite === s.id ? inviteHtml(s) : ""}
      <nav class="tabs" role="tablist">${TAB_ORDER.map(t => `<button class="tab" role="tab" data-tab="${t}" aria-selected="${S.tab === t}">${t === "overview" ? "Overview" : t === "note" ? "Notes" : TYPES[t].tab}${counts[t] !== "" ? `<span class="count">${counts[t]}</span>` : ""}</button>`).join("")}</nav>
      <section class="panel">${S.tab === "overview" ? overview(s) : S.tab === "note" ? notesPanel(s) : panel(S.tab)}</section>`;
  }
  function inviteHtml(s) {
    const email = s.grp === "Junior" && s.guardian_email ? s.guardian_email : (s.email || s.guardian_email);
    return `<div class="invite"><b>Send this to ${esc(s.grp === "Junior" && s.guardian_email ? "the parent" : String(s.name).split(/\s+/)[0])}</b><pre id="inviteText">${esc(inviteText(s, email))}</pre>
      <div style="display:flex;gap:8px"><button class="btn small primary" data-act="copy-invite">Copy text</button><button class="btn small" data-act="close-invite">Done</button></div></div>`;
  }
  const appUrl = () => location.origin;
  function inviteText(s, email) {
    const first = String(s.name).split(/\s+/)[0];
    return s.grp === "Junior" && s.guardian_email
      ? `Hi! ${first}'s practice plan, drills and lesson notes now live in my Student Practice Hub:\n${appUrl()}\n\nSign in with ${email}. You'll get a 6-digit code by email, with no password needed. On iPhone, tap Share → "Add to Home Screen" to keep it like an app.\n\n– Karina`
      : `Hi ${first}! Your practice plan, drills and lesson notes now live in my Student Practice Hub:\n${appUrl()}\n\nSign in with ${email}. You'll get a 6-digit code by email, with no password needed. On iPhone, tap Share → "Add to Home Screen" to keep it like an app.\n\n– Karina`;
  }

  function overview(s) {
    const lessons = sortDateDesc(of("lesson"));
    const drills = of("drill");
    const active = drills.filter(d => d.status !== "Mastered");
    const plan = of("plan");
    const planned = plan.reduce((a, p) => a + (+p.minutes || 0), 0);
    const done = plan.filter(p => p.done).reduce((a, p) => a + (+p.minutes || 0), 0);
    const rounds = sortDateDesc(of("stat"));
    const last = lessons[0];
    const pct = planned ? Math.round(done / planned * 100) : 0;
    const flags = of("fitness").filter(f => f.kind === "TPI screen" && (f.result === "Fail" || f.result === "Needs work"));
    const hw = lessons.find(l => l.homework);
    return `<div class="kpis">
      <div class="kpi"><div class="l">Lessons logged</div><div class="v">${lessons.length}</div><div class="h">${last ? "Last: " + esc(fmtDate(last.date)) : "None yet"}</div></div>
      <div class="kpi"><div class="l">Active drills</div><div class="v">${active.length}</div><div class="h">${drills.length - active.length} mastered</div></div>
      <div class="kpi"><div class="l">Practice this week</div><div class="v">${done}<span style="font-size:18px;color:var(--ink-3)"> / ${planned} min</span></div><div class="progress" aria-label="${pct}% done"><i style="width:${pct}%"></i></div></div>
      <div class="kpi"><div class="l">Last round</div><div class="v">${rounds[0] ? esc(rounds[0].score) : "–"}</div><div class="h">${rounds[0] ? esc((rounds[0].holes || "18") + " holes · " + (rounds[0].course || fmtDate(rounds[0].date))) : "No rounds yet"}</div></div>
    </div>
    <div class="grid2">
      <div class="box"><h4>Season goals</h4><p style="white-space:pre-wrap">${s.goals ? esc(s.goals) : '<span style="color:var(--ink-3)">No goals set. Use Edit profile to add them.</span>'}</p></div>
      <div class="box"><h4>Current homework</h4>${hw ? `<p style="white-space:pre-wrap">${esc(hw.homework)}</p><p style="font-size:12px;color:var(--ink-3);margin-top:6px">From ${esc(fmtDate(hw.date))} · ${esc(hw.focus || "")}</p>` : '<p style="color:var(--ink-3)">No homework yet.</p>'}</div>
      <div class="box"><h4>Score trend (18 holes)</h4>${chart(rounds)}</div>
      <div class="box"><h4>Fitness flags</h4>${flags.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${flags.map(f => `<span class="pill ${f.result === "Fail" ? "bad" : "warn"}">${esc(f.name)}</span>`).join("")}</div>` : '<p style="color:var(--ink-3)">No TPI flags logged.</p>'}
        ${s.coach_notes ? `<h4 style="margin-top:14px">Coach notes (private)</h4><p style="white-space:pre-wrap">${esc(s.coach_notes)}</p>` : ""}</div>
    </div>`;
  }

  function chart(rounds) {
    const pts = rounds.filter(r => String(r.holes || "18") === "18" && r.score !== "" && r.score != null && !isNaN(+r.score)).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(-12);
    if (pts.length < 2) return '<p style="color:var(--ink-3)">Log two or more 18-hole rounds to see the trend.</p>';
    const W = 560, H = 190, L = 38, R = 16, T = 14, B = 28;
    const ys = pts.map(p => +p.score);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    lo = Math.floor((lo - 2) / 5) * 5; hi = Math.ceil((hi + 2) / 5) * 5; if (hi === lo) hi = lo + 5;
    const x = i => L + i * (W - L - R) / (pts.length - 1);
    const y = v => T + (v - lo) * (H - T - B) / (hi - lo);
    const step = (hi - lo) <= 15 ? 5 : 10; const ticks = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(+p.score).toFixed(1)}`).join(" ");
    const area = `${x(0)},${H - B} ${line} ${x(pts.length - 1)},${H - B}`;
    return `<div class="scroll"><svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="18-hole scores over time">
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("")}
      <polygon points="${area}" fill="var(--pine-soft)" opacity=".7"/>
      <polyline points="${line}" fill="none" stroke="var(--pine)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(+p.score)}" r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? "var(--flag)" : "var(--pine)"}" stroke="var(--surface)" stroke-width="1.5"/>`).join("")}
      <text x="${x(0)}" y="${H - 8}" text-anchor="start">${esc(fmtDate(pts[0].date))}</text>
      <text x="${x(pts.length - 1)}" y="${H - 8}" text-anchor="end">${esc(fmtDate(pts[pts.length - 1].date))}</text>
    </svg></div><p style="font-size:12px;color:var(--ink-3);margin-top:4px">Better (lower) scores sit higher on the chart. Latest round in yellow.</p>`;
  }

  function head(t, extra = "") {
    return `<div class="panel-head"><div><h3>${TYPES[t].tab}</h3><p>${TYPES[t].sub}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${extra}<button class="btn primary small" data-act="add" data-type="${t}">+ Add ${TYPES[t].one.toLowerCase()}</button></div></div>`;
  }
  const empty = t => `<div class="empty">No ${TYPES[t].tab.toLowerCase()} yet.</div>`;
  const statusPill = v => { const c = { "Mastered": "good", "Pass": "good", "In progress": "warn", "Needs work": "warn", "Fail": "bad", "Assigned": "neutral" }[v] || "neutral"; return v ? `<span class="pill ${c}">${esc(v)}</span>` : ""; };
  const vid = u => { const s = safeUrl(u); return s ? `<a href="${esc(s)}" target="_blank" rel="noopener">Video</a>` : ""; };
  const byWho = e => e.author === "student" ? ` <span class="pill neutral">by student</span>` : "";

  function panel(t) {
    const rows = of(t);
    if (t === "lesson") {
      const r = sortDateDesc(rows);
      return head(t) + (r.length ? `<div class="entries">${r.map(e => { const dp = dateParts(e.date); return `<div class="entry" data-edit="${esc(e.id)}" role="button" tabindex="0">
        <div class="date-block"><div class="d">${dp.d}</div><div class="m">${dp.m}</div></div>
        <div><div class="t">${esc(e.focus)}</div><div class="body">${esc(e.notes)}</div>${e.homework ? `<div class="hw"><b>Homework:</b> ${esc(e.homework)}</div>` : ""}${e.video_pid ? `<div style="margin-top:8px">${videoThumb(e.video_pid, "Lesson video")}</div>` : ""}</div>
        <div style="text-align:right"><span class="pill neutral">${esc(e.kind || "Lesson")}</span><div style="font-size:12px;margin-top:4px">${vid(e.video)}</div></div></div>`; }).join("")}</div>` : empty(t));
    }
    if (t === "drill") {
      const order = { "In progress": 0, "Assigned": 1, "Mastered": 2 };
      const r = rows.slice().sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || String(a.name).localeCompare(String(b.name)));
      return head(t) + (r.length ? `<div class="entries">${r.map(e => { const sc = scoresFor(e.id); const last = sc[sc.length - 1]; const max = +e.of || 10;
        return `<div class="entry" data-edit="${esc(e.id)}" role="button" tabindex="0" style="grid-template-columns:1fr auto">
        <div><div class="t">${esc(e.name)} ${areaChip(e.category)}</div>
        ${e.goal ? `<div style="font-size:13px;margin-top:2px"><b>Target:</b> <span class="hcp">${esc(e.goal)}/${esc(e.of || 10)}</span> ${esc(e.target || "")}</div>` : ""}
        <div class="body">${esc(e.notes)}${e.video ? " · " + vid(e.video) : ""}</div>
        ${e.video_pid ? `<div style="margin-top:8px">${videoThumb(e.video_pid, "Demo")}</div>` : ""}
        ${sc.length ? `<div class="scoreline">Scores: ${sc.slice(-6).map(x => x.score).join(" → ")}${last ? ` · last ${esc(shortDate(last.scored_on))}` : ""}<span class="mini" aria-hidden="true">${sc.slice(-8).map(x => `<i style="height:${Math.max(2, x.score / max * 22)}px"></i>`).join("")}</span></div>` : e.goal ? `<div class="scoreline" style="color:var(--ink-3)">No scores logged yet</div>` : ""}</div>
        <div>${statusPill(e.status)}</div></div>`; }).join("")}</div>` : empty(t));
    }
    if (t === "stat") {
      const r = sortDateDesc(rows);
      const avg = k => { const v = r.filter(x => String(x.holes || "18") === "18" && x[k] !== "" && x[k] != null && !isNaN(+x[k])).map(x => +x[k]); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "–"; };
      return head(t) + (r.length ? `
        <div class="kpis"><div class="kpi"><div class="l">Avg score (18)</div><div class="v">${avg("score")}</div></div>
        <div class="kpi"><div class="l">Avg GIR</div><div class="v">${avg("gir")}</div></div>
        <div class="kpi"><div class="l">Avg putts</div><div class="v">${avg("putts")}</div></div>
        <div class="kpi"><div class="l">Rounds</div><div class="v">${r.length}</div></div></div>
        <div class="box">${chart(r)}</div>
        <div class="scroll"><table class="card"><thead><tr><th>Date</th><th>Course</th><th>Type</th><th class="n">Holes</th><th class="n">Score</th><th class="n">FW</th><th class="n">GIR</th><th class="n">Putts</th><th class="n">U&amp;D</th><th class="n">Pen</th></tr></thead>
        <tbody>${r.map(e => `<tr class="row" data-edit="${esc(e.id)}" tabindex="0"><td>${esc(fmtDate(e.date))}${e.author === "student" ? " ·&nbsp;S" : ""}</td><td>${esc(e.course)}</td><td>${esc(e.event)}</td><td class="n">${esc(e.holes || "18")}</td><td class="n"><b>${esc(e.score)}</b></td><td class="n">${esc(e.fairways)}</td><td class="n">${esc(e.gir)}</td><td class="n">${esc(e.putts)}</td><td class="n">${esc(e.updown)}</td><td class="n">${esc(e.penalties)}</td></tr>`).join("")}</tbody></table></div>
        <p style="font-size:12px;color:var(--ink-3);margin:0">S = logged by the student.</p>` : empty(t));
    }
    if (t === "plan") {
      const planned = rows.reduce((a, p) => a + (+p.minutes || 0), 0), done = rows.filter(p => p.done).reduce((a, p) => a + (+p.minutes || 0), 0);
      const extra = rows.some(r => r.done) ? `<button class="btn small" data-act="reset-week">Start new week</button>` : "";
      const drills = Object.fromEntries(of("drill").map(d => [d.id, d]));
      return head(t, extra) + `<div class="box" style="display:flex;flex-direction:column;gap:6px"><div style="display:flex;justify-content:space-between;font-size:13px"><b>${done} of ${planned} minutes done</b><span class="hcp">${planned ? Math.round(done / planned * 100) : 0}%</span></div><div class="progress"><i style="width:${planned ? done / planned * 100 : 0}%"></i></div></div>
        ${rows.length ? `<div class="box" style="display:flex;flex-direction:column;gap:8px"><h4 style="margin:0">Focus this week</h4>${focusBar(rows, p => p.minutes, p => p.area)}</div>` : ""}
        <div class="week">${DAYS.map(d => { const b = rows.filter(r => r.day === d); const m = b.reduce((a, p) => a + (+p.minutes || 0), 0);
          return `<div class="day"><h5>${d}<span>${m ? m + " min" : ""}</span></h5>${b.map(e => { const dr = e.drill && drills[e.drill]; const sc = dr ? scoresFor(dr.id) : []; const ls = sc[sc.length - 1];
            return `<div class="block ${e.done ? "done" : ""}">
            <input type="checkbox" id="chk-${esc(e.id)}" data-toggle="${esc(e.id)}" ${e.done ? "checked" : ""} aria-label="Mark ${esc(e.title)} done">
            <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">${areaChip(e.area)}<div class="bt" data-edit="${esc(e.id)}">${esc(e.title)}</div><div class="bd">${e.minutes ? esc(e.minutes) + " min" : ""}${e.details ? " · " + esc(e.details) : ""}</div>
            ${dr ? `<div class="bd" style="color:var(--pine)">${ls ? `Score ${ls.score}/${ls.out_of}` : "Drill"} · target ${esc(dr.goal || "–")}</div>` : ""}</div></div>`; }).join("") || '<span style="font-size:12px;color:var(--ink-3)">Rest</span>'}</div>`; }).join("")}</div>`;
    }
    if (t === "fitness") {
      const r = sortDateDesc(rows);
      const screen = r.filter(e => e.kind !== "Exercise"), ex = r.filter(e => e.kind === "Exercise");
      const list = a => a.length ? `<div class="entries">${a.map(e => { const dp = dateParts(e.date); return `<div class="entry" data-edit="${esc(e.id)}" role="button" tabindex="0">
        <div class="date-block"><div class="d">${dp.d}</div><div class="m">${dp.m}</div></div>
        <div><div class="t">${esc(e.name)}${e.dose ? ` <span class="hcp">· ${esc(e.dose)}</span>` : ""}</div><div class="body">${esc(e.notes)}${e.video ? " · " + vid(e.video) : ""}</div>${e.video_pid ? `<div style="margin-top:8px">${videoThumb(e.video_pid, "Demo")}</div>` : ""}</div>
        <div>${e.result && e.result !== "—" ? statusPill(e.result) : ""}</div></div>`; }).join("")}</div>` : '<div class="empty">Nothing logged.</div>';
      const h = txt => `<h4 style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3)">${txt}</h4>`;
      return head(t) + `<div class="grid2"><div style="display:flex;flex-direction:column;gap:10px">${h("TPI screen")}${list(screen)}</div><div style="display:flex;flex-direction:column;gap:10px">${h("Exercises")}${list(ex)}</div></div>`;
    }
    return "";
  }

  function notesPanel(s) {
    const notes = of("note").slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    return `<div class="panel-head"><div><h3>Notes</h3><p>Messages between you and ${esc(String(s.name).split(/\s+/)[0])}. They see your replies in the app.</p></div></div>
      <div class="thread">${notes.map(n => `<div class="msg ${n.author === "coach" ? "coach" : "student"}">${n.text ? esc(n.text) : ""}${n.video_pid ? `<div style="margin-top:${n.text ? 8 : 0}px">${videoThumb(n.video_pid, n.author === "coach" ? "Your video" : "Swing video")}</div>` : ""}<small>${n.author === "coach" ? "You" : esc(String(s.name).split(/\s+/)[0])} · ${esc(shortDate(n.created_at))}${n.author === "coach" ? ` · <button class="linkbtn" style="font-size:11px" data-delnote="${esc(n.id)}">Delete</button>` : ""}</small></div>`).join("") || '<div class="empty">No notes yet.</div>'}</div>
      <form class="reply" id="replyForm" novalidate style="flex-direction:column;align-items:stretch">
        <textarea id="replyText" aria-label="Write a note" placeholder="Write a note, answer a question, or send a swing review"></textarea>
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap"><div id="replyVideo"></div><button class="btn primary" type="submit">Send</button></div></form>`;
  }

  // ---------- forms
  function fieldHtml(prefix, f, val) {
    const id = `f-${prefix}-${f.k}`, v = val ?? "";
    const cls = "field" + (f.full ? " full" : "") + (f.t === "check" ? " check" : "");
    if (f.t === "video") return `<div class="${cls}"><label>${esc(f.l)}</label><div data-vfield="${f.k}"></div></div>`;
    if (f.t === "check") return `<div class="${cls}"><input type="checkbox" id="${id}" name="${f.k}" ${v ? "checked" : ""}><label for="${id}">${esc(f.l)}</label></div>`;
    let input;
    if (f.t === "textarea") input = `<textarea id="${id}" name="${f.k}" placeholder="${esc(f.ph || "")}">${esc(v)}</textarea>`;
    else if (f.t === "select") input = `<select id="${id}" name="${f.k}">${f.opts.map(o => `<option ${String(o) === String(v) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    else if (f.t === "drill") { const ds = of("drill"); input = `<select id="${id}" name="${f.k}"><option value="">None</option>${ds.map(d => `<option value="${esc(d.id)}" ${d.id === v ? "selected" : ""}>${esc(d.name)}${d.goal ? ` (target ${esc(d.goal)}/${esc(d.of || 10)})` : ""}</option>`).join("")}</select>`; }
    else input = `<input id="${id}" name="${f.k}" type="${f.t}" ${f.t === "number" ? 'inputmode="decimal" step="any"' : ""} value="${esc(v)}" placeholder="${esc(f.ph || "")}">`;
    return `<div class="${cls}"><label for="${id}">${esc(f.l)}${f.req ? " *" : ""}</label>${input}</div>`;
  }
  function openForm({ title, prefix, fields, data, onSave, onDelete, deleteLabel, extra }) {
    const mr = document.getElementById("modalRoot");
    mr.innerHTML = `<div class="overlay" data-close="1"><form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate>
      <h3>${esc(title)}</h3><div class="form">${fields.map(f => fieldHtml(prefix, f, data ? data[f.k] : (f.t === "date" && f.req ? today() : undefined))).join("")}</div>
      ${extra || ""}
      <div class="modal-actions">${onDelete ? `<button type="button" class="btn danger" data-del="1">${esc(deleteLabel || "Delete")}</button>` : ""}
      <div class="right"><button type="button" class="btn" data-close="1">Cancel</button><button type="submit" class="btn primary">Save</button></div></div></form></div>`;
    const form = mr.querySelector("form");
    const vids = {};
    fields.filter(f => f.t === "video").forEach(f => { vids[f.k] = videoField(form.querySelector(`[data-vfield="${f.k}"]`), data ? data[f.k] : ""); });
    const close = () => { mr.innerHTML = ""; document.removeEventListener("keydown", esck); };
    const esck = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esck);
    mr.querySelector(".overlay").addEventListener("click", e => { if (e.target.dataset.close) close(); });
    const first = form.querySelector("input,select,textarea"); if (first) first.focus();
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const out = {};
      if (Object.values(vids).some(v => v.busy)) { toast("Wait for the video to finish uploading."); return; }
      for (const f of fields) {
        if (f.t === "video") { out[f.k] = vids[f.k].value; continue; }
        const el = form.elements[f.k];
        if (f.t === "check") out[f.k] = el.checked;
        else if (f.t === "number") out[f.k] = el.value === "" ? "" : +el.value;
        else out[f.k] = el.value.trim();
        if (f.req && (out[f.k] === "" || out[f.k] == null)) { el.focus(); toast(f.l + " is required."); return; }
        if (f.t === "email" && out[f.k] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out[f.k])) { el.focus(); toast("Check the email address."); return; }
      }
      const btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
      const ok = await onSave(out);
      btn.disabled = false;
      if (ok !== false) close();
    });
    const del = form.querySelector("[data-del]");
    if (del) del.addEventListener("click", async () => {
      if (!del.classList.contains("armed")) { const l = del.textContent; del.classList.add("armed"); del.textContent = "Click again to confirm"; setTimeout(() => { del.classList.remove("armed"); del.textContent = l; }, 3500); return; }
      const ok = await onDelete(); if (ok !== false) close();
    });
  }
  function studentForm(s) {
    const nulls = d => { const o = { ...d }; ["email", "guardian_email", "start_date", "next_lesson"].forEach(k => { if (o[k] === "") o[k] = null; }); if (o.email) o.email = o.email.toLowerCase(); if (o.guardian_email) o.guardian_email = o.guardian_email.toLowerCase(); return o; };
    openForm({
      title: s ? "Edit profile" : "New student", prefix: "student", fields: STUDENT_FIELDS,
      data: s || { grp: "Adult", start_date: today() },
      extra: s ? `<div class="field check"><input type="checkbox" id="f-student-archived" ${s.archived ? "checked" : ""}><label for="f-student-archived">Archived (stopped lessons). Their sign-in stops working; history is kept.</label></div>` : "",
      onSave: async d => {
        if (!d.email && !d.guardian_email) toast("Tip: add a sign-in email so they can use the app.");
        if (s) { d.archived = document.getElementById("f-student-archived").checked; return !!(await write(api.updateStudent(s.id, nulls(d)), "Profile saved")); }
        const row = await write(api.addStudent(nulls(d)), "Student added");
        if (row && row.id) { S.tab = "overview"; S.invite = (row.email || row.guardian_email) ? row.id : null; await openStudent(row.id); }
        return !!row;
      },
      deleteLabel: "Delete student",
      onDelete: s ? async () => { const ok = await write(api.deleteStudent(s.id), "Student deleted"); if (ok) { S.sel = null; S.view = "checkin"; await refresh(); } return ok; } : null
    });
  }
  function entryForm(type, e) {
    const T = TYPES[type];
    const defaults = type === "plan" ? { day: DAYS[(new Date().getDay() + 6) % 7] } : type === "drill" ? { status: "Assigned", of: 10 } : null;
    openForm({
      title: (e ? "Edit " : "New ") + T.one.toLowerCase(), prefix: type, fields: T.fields, data: e || defaults,
      onSave: async d => {
        if (type === "plan" && d.drill && !d.area) { const dr = of("drill").find(x => x.id === d.drill); if (dr) d.area = dr.category; }
        return !!(e ? await write(api.updateEntry(e, d), "Saved") : await write(api.addEntry(S.sel, type, d), T.one + " added"));
      },
      onDelete: e ? () => write(api.deleteEntry(e.id), "Deleted") : null
    });
  }

  // ---------- render & navigation
  let replyVideo = null;
  function render() {
    const view = document.getElementById("cview");
    if (view.querySelector(".vprog")) { clearTimeout(render._t); render._t = setTimeout(render, 1500); return; } // an upload is in progress: redraw afterwards
    const main = S.view === "student" ? studentHtml() : checkinHtml();
    const focusId = document.activeElement?.id;
    const keep = {};
    view.querySelectorAll("textarea[id],input[id]").forEach(el => { if (el.type !== "file" && el.type !== "checkbox") keep[el.id] = el.value; });
    const prevVideo = replyVideo && S.view === "student" && S.tab === "note" ? replyVideo.value : "";
    view.innerHTML = `<div class="c-wrap"><div class="app ${S.view === "student" || S.view === "checkin" ? "has-student" : ""}" id="capp">${rosterHtml()}<main class="main">${main}</main></div></div>`;
    Object.entries(keep).forEach(([id, v]) => { const el = document.getElementById(id); if (el && id !== "search" && !el.value) el.value = v; });
    const rv = document.getElementById("replyVideo");
    replyVideo = rv ? videoField(rv, prevVideo, { label: "Attach video" }) : null;
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (el.setSelectionRange && el.value != null) el.setSelectionRange(el.value.length, el.value.length); } }
  }
  async function openStudent(id) {
    S.sel = id; S.view = "student"; S.entries = []; S.scores = []; S.invite = S.invite === id ? id : null;
    if (stopWatch) stopWatch();
    stopWatch = api.watch([id], soon);
    try { await loadStudent(); } catch (err) { toast(friendly(err)); }
    render(); window.scrollTo(0, 0);
  }
  async function openCheckin() {
    S.view = "checkin"; S.sel = null;
    if (stopWatch) stopWatch();
    stopWatch = api.watch(null, soon);
    try { await loadWeek(); } catch (err) { toast(friendly(err)); }
    render(); window.scrollTo(0, 0);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied. Paste it into a text or email."); }
    catch { toast("Couldn't copy automatically. Select the text and copy it."); }
  }

  root.onclick = async ev => {
    const t = ev.target.closest("[data-sid],[data-tab],[data-act],[data-edit],[data-filter],[data-view],[data-remind],[data-delnote]");
    if (!t || t.closest("#modalRoot")) return;
    if (t.dataset.sid) { S.tab = "overview"; await openStudent(t.dataset.sid); return; }
    if (t.dataset.view) { await openCheckin(); return; }
    if (t.dataset.filter) { S.filter = t.dataset.filter; render(); return; }
    if (t.dataset.tab) { S.tab = t.dataset.tab; render(); return; }
    if (t.dataset.remind) { const s = S.students.find(x => x.id === t.dataset.remind); if (s) await copy(reminderText(s)); return; }
    if (t.dataset.delnote) { await write(api.deleteEntry(t.dataset.delnote), "Note deleted"); return; }
    const a = t.dataset.act;
    if (a === "add-student") return studentForm();
    if (a === "edit-student") return studentForm(S.students.find(x => x.id === S.sel));
    if (a === "invite") { S.invite = S.sel; render(); return; }
    if (a === "close-invite") { S.invite = null; render(); return; }
    if (a === "copy-invite") { await copy(document.getElementById("inviteText").textContent); return; }
    if (a === "toggle-archived") { S.showArchived = !S.showArchived; render(); return; }
    if (a === "signout") { if (stopWatch) stopWatch(); await api.signOut(); root.onclick = root.onchange = root.onsubmit = root.oninput = root.onkeydown = null; onSignOut(); return; }
    if (a === "add") return entryForm(t.dataset.type);
    if (a === "reset-week") {
      try { for (const r of of("plan").filter(r => r.done)) await api.setPlanDone(r.id, false); toast("New week started"); } catch (err) { toast(friendly(err)); }
      await refresh(); return;
    }
    if (t.dataset.edit) { const e = S.entries.find(x => x.id === t.dataset.edit); if (e) entryForm(e.type, e); }
  };
  root.onkeydown = ev => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches("[data-edit][tabindex]")) { ev.preventDefault(); ev.target.click(); } };
  root.onchange = ev => { const id = ev.target.dataset?.toggle; if (id) write(api.setPlanDone(id, ev.target.checked)); };
  root.oninput = ev => { if (ev.target.id === "search") { S.q = ev.target.value; render(); } };
  root.onsubmit = async ev => {
    if (ev.target.id !== "replyForm") return;
    ev.preventDefault();
    const text = document.getElementById("replyText").value.trim();
    if (replyVideo?.busy) { toast("Wait for the video to finish uploading."); return; }
    const video_pid = replyVideo?.value || "";
    if (!text && !video_pid) { toast("Write a note or attach a video first."); return; }
    document.getElementById("replyText").value = "";
    if (replyVideo) replyVideo.value = "";
    const ok = await write(api.addEntry(S.sel, "note", video_pid ? { text, video_pid } : { text }), "Sent");
    if (!ok) document.getElementById("replyText").value = text;
  };

  root.innerHTML = `<div id="cview"><div class="center-msg"><div><p>Loading your students…</p></div></div></div><div id="modalRoot"></div>`;
  bindPlayer(root);
  (async () => {
    try { await loadStudents(); } catch (err) { toast(friendly(err)); }
    await openCheckin();
  })();
}
