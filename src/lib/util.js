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
  if (!d) return { d: "–", m: "" };
  const [y, m, dd] = d.split("-");
  return { d: String(+dd), m: MONTHS[+m - 1] + " " + y.slice(2), mon: MONTHS[+m - 1] };
}
export function fmtDate(d) {
  if (!d) return "";
  const p = d.slice(0, 10).split("-");
  return `${MONTHS[+p[1] - 1]} ${+p[2]}, ${p[0]}`;
}
export function shortDate(d) {
  if (!d) return "";
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
export function friendly(err) {
  const m = String(err?.message || err || "");
  if (/not_invited|Database error saving new user|Signups not allowed/i.test(m)) return "That email isn't on Karina's list yet. Check the spelling, or ask Karina to add you.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/expired|invalid.*(otp|token)|Token has expired/i.test(m)) return "That code didn't work. Check it, or send a new one.";
  if (/row-level security|not_allowed/i.test(m)) return "You don't have permission to change that.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "No connection. Check your internet and try again.";
  return "Something went wrong. Try again.";
}
