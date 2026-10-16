import LOGO from "../logo.svg?raw";
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const AREAS = [
  ["Putting", "--a1"], ["Short game", "--a2"], ["Full swing", "--a3"],
  ["Fitness", "--a4"], ["Mental", "--a5"], ["On course", "--a6"]
];
export const AREA_NAMES = AREAS.map(a => a[0]);

export const $ = (s, root = document) => root.querySelector(s);
export const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const initials = n => String(n || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

// Dates are stored as YYYY-MM-DD in the student's local calendar.
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const todayIndex = () => (new Date().getDay() + 6) % 7; // Mon = 0
export function dateParts(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(String(d))) return { d: "–", m: "", mon: "" };
  const [y, m, dd] = d.split("-");
  return { d: String(+dd), m: MONTHS[+m - 1] + " " + y.slice(2), mon: MONTHS[+m - 1] };
}
// Timestamps (with a time) are shown in the viewer's local date, not UTC.
const localDay = d => { if (!/T/.test(d)) return d; const x = new Date(d); return isNaN(x) ? d : `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export function fmtDate(d) {
  if (!d) return "";
  d = localDay(String(d));
  const p = d.slice(0, 10).split("-");
  return `${MONTHS[+p[1] - 1]} ${+p[2]}, ${p[0]}`;
}
export function shortDate(d) {
  if (!d) return "";
  d = localDay(String(d));
  const p = d.slice(0, 10).split("-");
  return `${MONTHS[+p[1] - 1]} ${+p[2]}`;
}
export function ago(ts) {
  if (!ts) return "never";
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
export function safeUrl(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
}

export const areaTok = n => (AREAS.find(a => a[0] === n) || ["", "--ink-3"])[1];
export const areaChip = n => n ? `<span class="area" style="--c:var(${areaTok(n)})">${esc(n)}</span>` : "";

// A single coloured bar of practice minutes by part of the game, plus a legend.
export function focusBar(items, minOf, areaOf) {
  const t = {};
  let sum = 0;
  items.forEach(p => { const a = areaOf(p) || "Other", m = +minOf(p) || 0; t[a] = (t[a] || 0) + m; sum += m; });
  if (!sum) return "";
  const rows = AREA_NAMES.concat(["Other"]).filter(a => t[a]);
  return `<div class="focus-bar" role="img" aria-label="Practice minutes by part of the game">${rows.map(a => `<i style="--c:var(${areaTok(a)});flex:${t[a]}"></i>`).join("")}</div>
  <div class="legend">${rows.map(a => `<span style="--c:var(${areaTok(a)})">${esc(a)} <b>${t[a]}m</b></span>`).join("")}</div>`;
}

let toastTimer;
export function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

// Turns Supabase errors into sentences a coach or student can act on.
// True when sign-in failed only because the email isn't on Karina's list.
// The sign-in screen treats this exactly like success, so nobody can use it to find out who is invited.
export const isNotInvited = err => /not_invited|Database error saving new user|Signups not allowed/i.test(String(err?.message || err || ""));

export function friendly(err) {
  const m = String(err?.message || err || "");
  if (isNotInvited(err)) return "That didn't work. Check your email and code, or ask Karina.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/expired|invalid.*(otp|token)|Token has expired/i.test(m)) return "That code didn't work. Check it, or send a new one.";
  if (/row-level security|not_allowed/i.test(m)) return "You don't have permission to change that.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "No connection. Check your internet and try again.";
  return "Something went wrong. Try again.";
}

// Karina's KSG monogram, coloured by the surrounding text colour.
export const logo = (cls = "logo", label = "Karina Sánchez Golf") =>
  LOGO.replace("<svg ", `<svg class="${cls}" role="img" aria-label="${label}" `);

// Unsaved text is kept in this browser until it's saved, so closing a form or switching screens never loses it.
export const draft = {
  get(key) { try { return JSON.parse(localStorage.getItem("sph.draft." + key) || "null"); } catch { return null; } },
  set(key, val) { try { localStorage.setItem("sph.draft." + key, JSON.stringify(val)); } catch {} },
  clear(key) { try { localStorage.removeItem("sph.draft." + key); } catch {} }
};

// ---- Calendar weeks (Monday to Sunday), as YYYY-MM-DD strings in local time
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const weekStartOf = (s = today()) => { const d = parse(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); };
export const weekDates = start => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export function weekLabel(start) {
  const a = parse(start), b = parse(addDays(start, 6));
  return a.getMonth() === b.getMonth()
    ? `${MONTHS[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
    : `${MONTHS[a.getMonth()]} ${a.getDate()} – ${MONTHS[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
}
export const dayName = s => DAYS[(parse(s).getDay() + 6) % 7];
export const dayNum = s => parse(s).getDate();
// A practice block's date. Older blocks only have a weekday: they belong to the current week.
export const blockDate = p => p.date || (p.day && DAYS.includes(p.day) ? addDays(weekStartOf(), DAYS.indexOf(p.day)) : weekStartOf());
