// Skill games screens (Practice → Skill games). Logic and wording live in ../lib/skillgames.js.
import { SKILL_GAMES, gameById, PLACES3, areaOfPlace, f1, spread, SPEEDS, SPEED_HELP, speedOrder, speedSummary, LADDERS,
  fewestTasks, fewestPar, ENERGY, byState, AFTER_GOOD, AFTER_POOR, reactionFavorites, decideShot, DECIDE_SECONDS, cr } from "../lib/skillgames.js";
import { CLUBS } from "../lib/roundstats.js";

export function createSkills(ctx) {
  const { S, render, top, esc, toast, run, api, draft, today, carried, myBag, bagEntry, levelOf, focusKey, seen, afterSave } = ctx;
  const key = () => `${S.sid}.skill`;
  const save = () => { if (S.skill && S.skill.phase !== "list" && S.skill.phase !== "setup") draft.set(key(), S.skill); else draft.clear(key()); };
  const level = () => levelOf(S.profile?.handicap);
  const name = () => S.profile?.name || "";
  // One step of undo for every change during play.
  const change = fn => { const G = S.skill; const { prev, ...cur } = G; G.prev = JSON.stringify(cur); fn(G); save(); render(); };
  const undo = () => { const G = S.skill; if (!G.prev) return; const p = JSON.parse(G.prev); Object.keys(G).forEach(k => delete G[k]); Object.assign(G, p); save(); render(); };

  const pick = (attr, list, cur) => `<div class="pick">${list.map(([v, l]) => `<button type="button" class="pick-btn" data-sk="${attr}" data-v="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join("")}</div>`;
  const rate5 = (attr, cur, lo, hi) => `<div class="pat-rate">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="pick-btn" data-sk="${attr}" data-v="${n}" aria-pressed="${cur === n}">${n}</button>`).join("")}</div><div class="pat-ends"><span>${lo}</span><span>${hi}</span></div>`;
  const clubOptions = () => { const b = myBag().filter(c => c.on !== false && c.club).map(c => c.club); return b.length >= 3 ? b : CLUBS; };
  const carryOf = club => carried(myBag()).find(c => c.club === club)?.carry || "";
  const footer = (G, canUndo = true) => `<div class="row2"><button class="btn" data-sk="undo" ${G.prev && canUndo ? "" : "disabled"}>Undo</button><button class="btn" data-sk="finish">Finish early</button></div>`;
  const prevBest = (id, k) => { const v = S.entries.filter(e => e.type === "session" && e.skill?.id === id && e.skill?.key === k && !e.skill?.skipped).map(e => +e.skill.balls).filter(x => x > 0); return v.length ? Math.min(...v) : null; };

  // ---------- list
  function listHtml() {
    return top("Skill games", name()) + `<main class="s-content">
      <section class="card"><p style="margin:0;font-size:15px">These games train the golfer, not just the swing: deciding, committing, your energy and what you do after the shot. Each one takes 15 to 45 minutes.</p></section>
      ${SKILL_GAMES.map(g => `<button class="games-cta alt sk-game" data-sk="open" data-v="${g.id}"><b>${esc(g.name)}</b><span>${esc(g.why)}</span><small>${g.mins} min · ${esc(g.area)}</small></button>`).join("")}
    </main>`;
  }

  // ---------- setup
  function setupHtml() {
    const G = S.skill, g = gameById(G.id);
    let body = "";
    if (G.id === "speed") {
      body = `<div class="field"><label for="sk-club">Club</label><select id="sk-club" class="lv-sel">${clubOptions().map(c => `<option ${c === G.club ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
        <p class="muted">A wedge or mid iron works best. You'll hit 12 balls: four speeds, three times each. The first round climbs from 25% to 100%, then the order mixes up.</p>
        <div class="sk-speeds">${SPEEDS.map(sp => `<div><b>${sp}%</b><span>${esc(SPEED_HELP[sp])}</span></div>`).join("")}</div>
        <p class="muted">After each ball, type the carry if you know it (launch monitor, flags or your best guess) and say whether you held your finish.</p>`;
    } else if (G.id === "ladder") {
      const rungs = LADDERS[level()];
      body = `<fieldset class="field"><legend>Where are you?</legend>${pick("place", PLACES3, G.place)}</fieldset>
        <div class="sk-rungs">${rungs.map((n, i) => `<div><small>Rung ${i + 1}</small><b>${n} in a row</b></div>`).join("")}</div>
        <p class="muted">New target every ball. Before each one: decide the shot, say it, commit. After it, rate your commitment. Only a 4 or 5 counts, and the result doesn't matter. Drop below 4 and that rung starts over.</p>`;
    } else if (G.id === "fewest") {
      const tasks = fewestTasks(level(), focusKey(), G.scope), par = fewestPar(tasks, level()), pb = prevBest("fewest", `${G.scope}-${level()}`);
      body = `<fieldset class="field"><legend>Which part of your game?</legend>${pick("scope", [["all", "Everything"], ["short", "Short game and putting"], ["range", "Range only"]], G.scope)}</fieldset>
        <ol class="sk-tasks">${tasks.map(t => `<li>${esc(t.label)}</li>`).join("")}</ol>
        <p class="muted">Target: <b>${par} balls or fewer</b>${pb ? ` · your best: <b>${pb}</b>` : ""}. Every ball counts, including the ones that miss. Full routine on every shot.</p>`;
    } else if (G.id === "energy") {
      body = `<fieldset class="field"><legend>Where are you?</legend>${pick("place", PLACES3, G.place)}</fieldset>
        <fieldset class="field"><legend>How many balls?</legend>${pick("balls", [[9, "9 balls"], [12, "12 balls"]], G.balls)}</fieldset>
        ${ENERGY.map(x => `<div class="sk-energy e-${x.id}"><b>${esc(x.name)}</b><span>${esc(x.how)}</span></div>`).join("")}
        <p class="muted">The app tells you which energy to create before each ball. Get there first, then hit.</p>`;
    } else if (G.id === "react") {
      body = `<fieldset class="field"><legend>Where are you?</legend>${pick("place", PLACES3, G.place)}</fieldset>
        <p class="muted">10 balls. After each one, say how it was, pick a reaction and do it. Then rate how ready you feel for the next shot. At the end you'll see which reactions work best for you.</p>`;
    } else if (G.id === "decide") {
      body = `<fieldset class="field"><legend>Where are you?</legend>${pick("place", PLACES3, G.place)}</fieldset>
        <fieldset class="field"><legend>How many balls?</legend>${pick("balls", [[9, "9 balls"], [12, "12 balls"]], G.balls)}</fieldset>
        <p class="muted">The app gives you a shot. Pick the club and shot on gut feel, no practice swings. Tap "I've decided", say it out loud, and hit within ${DECIDE_SECONDS} seconds.</p>`;
    }
    return top(g.name, name()) + `<main class="s-content"><section class="card"><h2>${esc(g.name)}</h2><p style="margin:0">${esc(g.why)}</p>${body}</section>
      <button class="btn primary" data-sk="start">Start</button><button class="btn" data-sk="list">Back to skill games</button></main>`;
  }

  // ---------- play
  function playHtml() {
    const G = S.skill, g = gameById(G.id);
    if (G.id === "speed") {
      const k = G.shots.length, sp = G.order[k];
      return top(g.name, `${G.club} · ball ${k + 1} of ${G.order.length}`) + `<main class="s-content">
        <section class="card sk-big"><small>Swing at</small><b>${sp}%</b><span>${esc(SPEED_HELP[sp])}</span></section>
        <section class="card"><div class="field"><label for="sk-carry-${k}">Carry (yards) <small>optional</small></label><input id="sk-carry-${k}" class="lv-num" inputmode="numeric" placeholder="${esc(carryOf(G.club) ? Math.round(carryOf(G.club) * (0.55 + sp / 225)) : "yds")}"></div>
          <h3 class="sh3">Did you hold your finish in balance?</h3>${pick("bal", [["1", "Yes"], ["0", "No"]], G.bal == null ? "" : G.bal ? "1" : "0")}
          <button class="btn primary" data-sk="next">${k + 1 >= G.order.length ? "Finish" : "Next ball"}</button></section>
        ${footer(G)}</main>`;
    }
    if (G.id === "ladder") {
      const rungs = G.rungs, need = rungs[G.rung];
      return top(g.name, `Rung ${G.rung + 1} of ${rungs.length} · ${G.balls} balls so far`) + `<main class="s-content">
        <div class="sk-ladder">${rungs.map((n, i) => `<div class="${i < G.rung ? "done" : i === G.rung ? "now" : ""}"><b>${n}</b><small>${i < G.rung ? "Done" : i === G.rung ? "Now" : "Next"}</small></div>`).join("")}</div>
        <section class="card sk-big"><small>In a row</small><b>${G.streak} / ${need}</b><div class="sk-dots">${Array.from({ length: need }, (_, i) => `<i class="${i < G.streak ? "on" : ""}"></i>`).join("")}</div></section>
        <div class="fz-before"><b>Before</b> New target. Decide the shot, say it, commit.</div>
        <section class="card"><h3 class="sh3">After · Commitment</h3><p class="fz-q">Did you stay fully committed from decision to finish?</p>${rate5("lc", 0, "Not at all", "Completely")}
          <p class="muted">Only 4 or 5 counts. The result doesn't matter here.</p></section>
        ${footer(G)}</main>`;
    }
    if (G.id === "fewest") {
      const t = G.tasks[G.ti], got = G.got;
      return top(g.name, `${G.balls} balls · target ${G.par}`) + `<main class="s-content">
        <section class="card sk-big"><small>${esc(t.area)} · task ${G.ti + 1} of ${G.tasks.length}</small><b class="sk-task">${esc(t.label)}</b><div class="sk-dots">${Array.from({ length: t.need }, (_, i) => `<i class="${i < got ? "on" : ""}"></i>`).join("")}</div><span>${G.onTask} ball${G.onTask === 1 ? "" : "s"} on this task</span></section>
        <div class="row2"><button class="btn primary" data-sk="fgood">Good one</button><button class="btn" data-sk="fmiss">Not yet</button></div>
        <button class="linkbtn" data-sk="fskip" style="align-self:center">Skip: can't do this one here</button>
        <section class="card"><h2>Your list</h2><ol class="sk-tasks">${G.tasks.map((x, i) => `<li class="${G.log[i] ? (G.log[i].skipped ? "skipped" : "done") : i === G.ti ? "now" : ""}">${esc(x.label)}${G.log[i] ? ` <small>${G.log[i].skipped ? "skipped" : G.log[i].balls + " balls"}</small>` : ""}</li>`).join("")}</ol></section>
        ${footer(G)}</main>`;
    }
    if (G.id === "energy") {
      const k = G.shots.length, st = ENERGY.find(x => x.id === G.order[k]);
      return top(g.name, `Ball ${k + 1} of ${G.order.length}`) + `<main class="s-content">
        <section class="card sk-energy sk-ebig e-${st.id}"><small>Get there first</small><b>${esc(st.name)}</b><span>${esc(st.how)}</span></section>
        <div class="fz-before"><b>Then</b> Decide the shot, commit, hit.</div>
        <section class="card"><h3 class="sh3">Commitment</h3>${rate5("ec", G.c, "Lost it", "All the way")}
          <h3 class="sh3" style="margin-top:6px">Result</h3>${rate5("er", G.r, "Not close", "Exactly it")}
          ${G.c && G.r ? `<button class="btn primary" data-sk="next">${k + 1 >= G.order.length ? "Finish" : "Next ball"}</button>` : ""}</section>
        ${footer(G)}</main>`;
    }
    if (G.id === "react") {
      const k = G.shots.length, list = G.kind === "good" ? AFTER_GOOD : AFTER_POOR, rt = list.find(x => x.id === G.routine);
      return top(g.name, `Ball ${k + 1} of ${G.total}`) + `<main class="s-content">
        <section class="card"><h3 class="sh3">1 · How was it?</h3>${pick("rk", [["good", "Good"], ["ok", "Okay"], ["poor", "Poor"]], G.res || "")}</section>
        ${G.res ? `<section class="card"><h3 class="sh3">2 · ${G.kind === "good" ? "Lock it in" : "Let it go"}: pick a reaction and do it</h3>
          <div class="sk-routines">${list.map(x => `<button type="button" class="sk-routine" data-sk="rr" data-v="${x.id}" aria-pressed="${G.routine === x.id}"><b>${esc(x.name)}</b><span>${esc(x.how)}</span></button>`).join("")}</div></section>` : ""}
        ${rt ? `<section class="card"><h3 class="sh3">3 · How ready do you feel for the next shot?</h3>${rate5("rf", G.feel, "Still stuck on it", "Ready to go")}
          ${G.feel ? `<button class="btn primary" data-sk="next">${k + 1 >= G.total ? "Finish" : "Next ball"}</button>` : ""}</section>` : ""}
        ${footer(G)}</main>`;
    }
    if (G.id === "decide") {
      const k = G.shots.length;
      return top(g.name, `Ball ${k + 1} of ${G.total}`) + `<main class="s-content">
        <section class="card sk-big"><small>Your shot</small><b class="sk-task">${esc(G.shot)}</b></section>
        ${!G.decidedAt ? `<button class="btn primary sk-go" data-sk="dgo">I've decided</button><p class="muted" style="text-align:center">Gut feel. No practice swings, no second-guessing.</p>`
          : `<section class="card sk-timer"><b id="sk-timer">${DECIDE_SECONDS}</b><span>Say it out loud, then hit.</span></section>
          <section class="card"><h3 class="sh3">Commitment</h3>${rate5("dc", G.c, "Second-guessed it", "Fully trusted it")}
            <h3 class="sh3" style="margin-top:6px">Result</h3>${rate5("dr", G.r, "Not close", "Exactly it")}
            <label class="sk-check"><input type="checkbox" data-sk="dch" ${G.changed ? "checked" : ""}> I changed my mind before hitting</label>
            ${G.c && G.r ? `<button class="btn primary" data-sk="next">${k + 1 >= G.total ? "Finish" : "Next ball"}</button>` : ""}</section>`}
        ${footer(G)}</main>`;
    }
    return "";
  }

  // ---------- results
  function result(G) {
    if (G.id === "speed") {
      const s = speedSummary(G.shots);
      const lines = [`${G.club}: ${s.map(x => `${x.speed}% ${x.carry ?? "–"}`).join(" · ")} yds`, `Finished in balance: ${G.shots.filter(x => x.balance).length} of ${G.shots.length}`];
      return { lines, data: { club: G.club, carries: Object.fromEntries(s.filter(x => x.carry).map(x => [x.speed, x.carry])) },
        html: `<table class="sk-table"><thead><tr><th>Speed</th><th>Carry</th><th>In balance</th></tr></thead><tbody>${s.map(x => `<tr><td>${x.speed}%</td><td>${x.carry ? x.carry + " yds" : "–"}</td><td>${x.balanced} of ${x.n}</td></tr>`).join("")}</tbody></table>
          ${s.some(x => x.carry) ? `<label class="sk-check"><input type="checkbox" id="sk-savebag" checked> Add these to my club distances</label>` : `<p class="muted">Type carries next time and the app builds your speed chart.</p>`}
          <p class="muted">The speed where you finish in balance most often is your best "stock" speed on the course.</p>` };
    }
    if (G.id === "ladder") {
      const lines = [`Rungs ${G.rung} of ${G.rungs.length} (${G.rungs.join("-")}) in ${G.balls} balls`, `Longest committed run: ${G.best}`];
      return { lines, data: { balls: G.balls, rungs: G.rungs, reached: G.rung },
        html: `<div class="pat-stats"><div><small>Rungs climbed</small><b>${G.rung} of ${G.rungs.length}</b></div><div><small>Balls used</small><b>${G.balls}</b></div><div><small>Longest run</small><b>${G.best}</b></div><div><small>Committed (4–5)</small><b>${G.shots.filter(x => x >= 4).length} of ${G.shots.length}</b></div></div>
          <p class="muted">Fewer balls to the top means your trust is getting stronger. Try to beat ${G.balls} next time.</p>` };
    }
    if (G.id === "fewest") {
      const skipped = G.log.some(x => x?.skipped), pb = prevBest("fewest", G.key);
      const areas = [...new Set(G.tasks.map(t => t.area))].map(a => [a, G.tasks.reduce((s, t, i) => s + (t.area === a && G.log[i] && !G.log[i].skipped ? G.log[i].balls : 0), 0)]);
      const lines = [`${G.balls} balls (target ${G.par})${skipped ? ", some tasks skipped" : pb && G.balls < pb ? ", new personal best" : ""}`, areas.map(([a, b]) => `${a} ${b}`).join(" · ")];
      return { lines, data: { key: G.key, balls: G.balls, par: G.par, skipped },
        html: `<div class="pat-stats"><div><small>Balls used</small><b>${G.balls}</b></div><div><small>Target</small><b>${G.par}</b></div><div><small>Personal best</small><b>${skipped ? "–" : pb ? Math.min(pb, G.balls) : G.balls}</b></div><div><small>Tasks</small><b>${G.log.filter(x => x && !x.skipped).length} of ${G.tasks.length}</b></div></div>
          ${areas.map(([a, b]) => `<div class="fz-kind" style="grid-template-columns:1fr auto"><span>${esc(a)}</span><span>${b} balls</span></div>`).join("")}
          <p class="muted">${skipped ? "Skipped tasks don't count toward a personal best." : G.balls <= G.par ? "Under target. Well done." : "Look at which part of the game took the most balls. That's your next practice."}</p>` };
    }
    if (G.id === "energy") {
      const st = byState(G.shots, "state", ENERGY), best = st.slice().sort((a, b) => (b.c + b.r) - (a.c + a.r))[0];
      const lines = [st.map(x => `${x.name} ${f1(x.c)}/${f1(x.r)}`).join(" · ") + " (commitment/result)", best ? `Best today: ${best.name}` : ""].filter(Boolean);
      return { lines, data: { best: best?.id },
        html: `${st.map(x => `<div class="fz-kind"><span>${esc(x.name)}</span><span>${x.n} balls</span><span>commitment ${f1(x.c)}</span><span>result ${f1(x.r)}</span></div>`).join("")}
          <p class="muted">${best ? `You played best <b>${esc(best.name.toLowerCase())}</b> today. Before your next round, practice getting into that state on the first tee.` : ""}</p>` };
    }
    if (G.id === "react") {
      const fav = reactionFavorites(G.shots), g1 = fav.good[0], p1 = fav.poor[0];
      const lines = [`Best after good shots: ${g1 ? g1.name : "–"} · after poor shots: ${p1 ? p1.name : "–"}`, `Ready for the next shot: ${f1(G.shots.length ? G.shots.reduce((a, s) => a + s.feel, 0) / G.shots.length : null)} of 5`];
      const row = x => `<div class="fz-kind" style="grid-template-columns:1fr auto auto"><span>${esc(x.name)}</span><span>${x.n} time${x.n > 1 ? "s" : ""}</span><span>ready ${f1(x.feel)}</span></div>`;
      return { lines, data: { good: g1?.id || "", poor: p1?.id || "" },
        html: `<h3 class="sh3">After good shots</h3>${fav.good.map(row).join("") || `<p class="muted">No good shots rated.</p>`}
          <h3 class="sh3" style="margin-top:8px">After poor shots</h3>${fav.poor.map(row).join("") || `<p class="muted">No poor shots rated.</p>`}
          <p class="muted">Use your top two on the course, every shot, for the next few rounds.</p>` };
    }
    if (G.id === "decide") {
      const s = cr(G.shots), changed = G.shots.filter(x => x.changed).length;
      const lines = [`Commitment ${f1(s.c)} · result ${f1(s.r)}`, `Changed my mind: ${changed} of ${G.shots.length}`];
      return { lines, data: {},
        html: `<div class="pat-stats"><div><small>Commitment</small><b>${f1(s.c)} of 5</b></div><div><small>Result</small><b>${f1(s.r)} of 5</b></div><div><small>Changed my mind</small><b>${changed} of ${G.shots.length}</b></div><div><small>Balls</small><b>${G.shots.length}</b></div></div>
          <p class="muted">${changed ? "Every change of mind is a doubt. Next time, trust the first answer." : "No second-guessing. That's what trust looks like."}</p>` };
    }
    return { lines: [], data: {}, html: "" };
  }
  function doneHtml() {
    const G = S.skill, g = gameById(G.id), R = result(G);
    return top(g.name, "Done") + `<main class="s-content">
      <section class="card"><h2>Your results</h2>${R.html}</section>
      <section class="card"><div class="field"><label for="sk-worked">What worked?</label><textarea id="sk-worked" placeholder="What you noticed, in your own words"></textarea></div>
        <div class="field"><label for="sk-useful">What will you use on the course?</label><textarea id="sk-useful" placeholder="One thing to take to your next round"></textarea></div></section>
      <button class="btn primary" data-sk="save">Save to my practice log</button>
      <div class="row2"><button class="btn" data-sk="resume">Keep going</button><button class="btn" data-sk="discard">Discard</button></div></main>`;
  }

  function screen() {
    const G = S.skill;
    if (!G || G.phase === "list") return listHtml();
    if (G.phase === "setup") return setupHtml();
    if (G.phase === "play") return playHtml();
    return doneHtml();
  }

  // ---------- actions
  function startGame() {
    const G = S.skill, base = { phase: "play", t0: Date.now(), t1: 0, prev: null };
    if (G.id === "speed") Object.assign(G, base, { order: speedOrder(), shots: [], bal: null });
    if (G.id === "ladder") Object.assign(G, base, { rungs: LADDERS[level()], rung: 0, streak: 0, best: 0, balls: 0, run: 0, shots: [] });
    if (G.id === "fewest") { const tasks = fewestTasks(level(), focusKey(), G.scope); Object.assign(G, base, { tasks, par: fewestPar(tasks, level()), key: `${G.scope}-${level()}`, ti: 0, got: 0, onTask: 0, balls: 0, log: [] }); }
    if (G.id === "energy") Object.assign(G, base, { order: spread(ENERGY.map(x => x.id), G.balls / 3), shots: [], c: 0, r: 0 });
    if (G.id === "react") Object.assign(G, base, { total: 10, shots: [], res: "", kind: "", routine: "", feel: 0 });
    if (G.id === "decide") Object.assign(G, base, { total: G.balls, shots: [], shot: decideShot(G.place, carried(myBag()).map(c => c.carry)), decidedAt: 0, c: 0, r: 0, changed: false });
    save(); render(); window.scrollTo(0, 0);
  }
  const finishGame = () => { const G = S.skill; G.phase = "done"; G.t1 = Date.now(); save(); render(); window.scrollTo(0, 0); };
  const top0 = () => window.scrollTo({ top: 0, behavior: "smooth" });

  function next() {
    const G = S.skill;
    if (G.id === "speed") {
      const v = (document.getElementById(`sk-carry-${G.shots.length}`)?.value || "").replace(/[^0-9]/g, "");
      if (G.bal == null) { toast("Tap whether you held your finish."); return; }
      change(X => { X.shots.push({ speed: X.order[X.shots.length], carry: v ? +v : null, balance: !!X.bal }); X.bal = null; if (X.shots.length >= X.order.length) { X.phase = "done"; X.t1 = Date.now(); } });
    } else if (G.id === "energy") {
      change(X => { X.shots.push({ state: X.order[X.shots.length], c: X.c, r: X.r }); X.c = 0; X.r = 0; if (X.shots.length >= X.order.length) { X.phase = "done"; X.t1 = Date.now(); } });
    } else if (G.id === "react") {
      change(X => { X.shots.push({ res: X.res, kind: X.kind, routine: X.routine, feel: X.feel }); Object.assign(X, { res: "", kind: "", routine: "", feel: 0 }); if (X.shots.length >= X.total) { X.phase = "done"; X.t1 = Date.now(); } });
    } else if (G.id === "decide") {
      change(X => { X.shots.push({ shot: X.shot, c: X.c, r: X.r, changed: X.changed }); Object.assign(X, { c: 0, r: 0, changed: false, decidedAt: 0 });
        if (X.shots.length >= X.total) { X.phase = "done"; X.t1 = Date.now(); } else X.shot = decideShot(X.place, carried(myBag()).map(c => c.carry)); });
    }
    top0();
  }
  function ladderRate(v) {
    change(G => {
      G.balls++; G.shots.push(v);
      if (v >= 4) { G.streak++; G.run++; G.best = Math.max(G.best, G.run); } else { if (G.streak) toast("Rung starts over. New target, full commitment."); G.streak = 0; G.run = 0; }
      if (G.streak >= G.rungs[G.rung]) { G.rung++; G.streak = 0; if (G.rung >= G.rungs.length) { G.phase = "done"; G.t1 = Date.now(); } else toast(`Rung ${G.rung} done. Next: ${G.rungs[G.rung]} in a row.`); }
    });
  }
  function fewest(kind) {
    change(G => {
      if (kind === "skip") G.log[G.ti] = { skipped: true, balls: G.onTask };
      else { G.balls++; G.onTask++; if (kind === "good") G.got++; }
      const t = G.tasks[G.ti];
      if (kind === "skip" || G.got >= t.need) {
        if (kind !== "skip") G.log[G.ti] = { balls: G.onTask };
        G.ti++; G.got = 0; G.onTask = 0;
        if (G.ti >= G.tasks.length) { G.phase = "done"; G.t1 = Date.now(); }
      }
    });
  }
  async function saveGame() {
    const G = S.skill, g = gameById(G.id), R = result(G);
    const played = G.id === "fewest" ? G.balls : G.id === "ladder" ? G.balls : (G.shots || []).length;
    if (!played) { toast("Hit at least one ball first."); return; }
    const mins = Math.max(5, Math.min(120, Math.round(((G.t1 || Date.now()) - G.t0) / 60000)));
    const areas = G.id === "speed" ? ["Full swing"] : G.id === "fewest" ? [...new Set(G.tasks.map(t => t.area))] : [...new Set([areaOfPlace(G.place), g.area])];
    const d = { date: today(), minutes: mins, areas, rating: "", worked: `${g.name}: ${R.lines.join(". ")}`,
      went: (document.getElementById("sk-worked")?.value || "").trim(), next: (document.getElementById("sk-useful")?.value || "").trim(),
      skill: { id: G.id, lines: R.lines, ...R.data } };
    const saveBag = G.id === "speed" && document.getElementById("sk-savebag")?.checked && Object.keys(R.data.carries || {}).length;
    const ok = await run(async () => {
      await api.addEntry(S.sid, "session", d);
      if (saveBag) {
        const e = bagEntry(), speeds = { ...(e?.speeds || {}), [G.club]: { ...R.data.carries, date: today() } };
        if (e) await api.updateEntry(e, { speeds }); else await api.addEntry(S.sid, "bag", { clubs: [], speeds });
      }
    }, "Saved to your practice log." + seen(" Karina will see it."));
    if (!ok) return;
    S.skill = null; save(); afterSave();
  }

  // Returns true if it handled the click.
  async function handle(el, e) {
    const a = el.dataset.sk, v = el.dataset.v, G = S.skill;
    if (a === "open") { S.skill = { id: v, phase: "setup", place: "range", balls: 12, scope: "all", club: clubOptions().includes("7 iron") ? "7 iron" : clubOptions()[Math.floor(clubOptions().length / 2)] }; render(); window.scrollTo(0, 0); return true; }
    if (a === "list") { S.skill = null; save(); render(); window.scrollTo(0, 0); return true; }
    if (!G) return true;
    if (a === "place") { G.place = v; render(); return true; }
    if (a === "balls") { G.balls = +v; render(); return true; }
    if (a === "scope") { G.scope = v; render(); return true; }
    if (a === "start") { if (G.id === "speed") G.club = document.getElementById("sk-club")?.value || G.club; startGame(); return true; }
    if (a === "undo") { undo(); return true; }
    if (a === "finish") { const any = G.id === "ladder" || G.id === "fewest" ? G.balls > 0 : (G.shots || []).length > 0; if (!any) { S.skill = null; save(); render(); return true; } finishGame(); return true; }
    if (a === "resume") { if (G.id === "speed") G.order.push(...SPEEDS); if (G.id === "energy") G.order.push(...spread(ENERGY.map(x => x.id), 1)); if (G.id === "react" || G.id === "decide") G.total += 3; if (G.id === "ladder" && G.rung >= G.rungs.length) G.rungs.push(G.rungs[G.rungs.length - 1] + 2); if (G.id === "fewest" && G.ti >= G.tasks.length) { toast("Your list is done. Save it, or start a new round."); return true; } G.phase = "play"; save(); render(); window.scrollTo(0, 0); return true; }
    if (a === "discard") {
      if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = "Tap again to discard"; setTimeout(() => { el.classList.remove("armed"); el.textContent = "Discard"; }, 3500); return true; }
      S.skill = null; save(); render(); window.scrollTo(0, 0); return true;
    }
    if (a === "save") { await saveGame(); return true; }
    if (a === "next") { next(); return true; }
    if (a === "bal") { G.bal = v === "1"; save(); render(); return true; }
    if (a === "lc") { ladderRate(+v); return true; }
    if (a === "fgood") { fewest("good"); return true; }
    if (a === "fmiss") { fewest("miss"); return true; }
    if (a === "fskip") { fewest("skip"); return true; }
    if (a === "ec") { G.c = +v; save(); render(); return true; }
    if (a === "er") { G.r = +v; save(); render(); return true; }
    if (a === "rk") { G.res = v; G.kind = v === "good" ? "good" : "poor"; G.routine = ""; G.feel = 0; save(); render(); return true; }
    if (a === "rr") { G.routine = v; save(); render(); return true; }
    if (a === "rf") { G.feel = +v; save(); render(); return true; }
    if (a === "dgo") { G.decidedAt = Date.now(); save(); render(); return true; }
    if (a === "dc") { G.c = +v; save(); render(); return true; }
    if (a === "dr") { G.r = +v; save(); render(); return true; }
    if (a === "dch") { G.changed = el.checked; save(); return true; }
    return true;
  }

  // Countdown for Decide and go (updates the number in place; no redraw).
  setInterval(() => {
    const el = document.getElementById("sk-timer"), G = S.skill;
    if (!el || !G || G.id !== "decide" || !G.decidedAt) return;
    const left = Math.max(0, DECIDE_SECONDS - Math.floor((Date.now() - G.decidedAt) / 1000));
    el.textContent = left ? String(left) : "Go!";
    el.parentElement.classList.toggle("late", !left);
  }, 250);

  return { screen, handle, restore: id => { const d = draft.get(`${id}.skill`); S.skill = d && d.t0 > Date.now() - 864e5 ? d : null; } };
}
