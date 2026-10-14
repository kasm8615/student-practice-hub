// Club distances ("My bag"): the clubs, a quick estimate from one club, and gapping checks.

// Typical carry relative to a 7 iron, for a first estimate the student then corrects.
export const BAG_CLUBS = [
  ["Driver", 1.52], ["3 wood", 1.38], ["5 wood", 1.28], ["4 hybrid", 1.2], ["4 iron", 1.17], ["5 iron", 1.11], ["6 iron", 1.06],
  ["7 iron", 1], ["8 iron", 0.93], ["9 iron", 0.86], ["PW", 0.79], ["GW", 0.69], ["SW", 0.59], ["LW", 0.48]
];

export const newBag = () => BAG_CLUBS.map(([club]) => ({ club, carry: "", total: "", on: true }));

export function estimateFrom7(carry7) {
  const c = +carry7;
  return BAG_CLUBS.map(([club, r]) => ({ club, carry: c ? String(Math.round(c * r)) : "" }));
}

// Turns names like "7i", "7-Iron", "Pitching wedge", "56°" into the app's club names.
export function normalizeClub(name) {
  const n = String(name || "").toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (!n || /putt/.test(n)) return "";
  if (/^(dr|driver|1w|1 wood)/.test(n)) return "Driver";
  let m = n.match(/^(\d)\s*(w|wood)\b/); if (m) return `${m[1]} wood`;
  m = n.match(/^(\d)\s*(h|hy|hyb|hybrid|rescue)\b/); if (m) return `${m[1]} hybrid`;
  if (/hybrid|rescue/.test(n)) return "4 hybrid";
  m = n.match(/^(\d)\s*(i|iron)\b/); if (m) return `${m[1]} iron`;
  if (/^(pw|p|pitching)/.test(n)) return "PW";
  if (/^(gw|gap|aw|approach|uw)/.test(n)) return "GW";
  if (/^(sw|sand)/.test(n)) return "SW";
  if (/^(lw|lob)/.test(n)) return "LW";
  m = n.match(/(\d{2})\s*°?/);
  if (m) { const d = +m[1]; if (d >= 44 && d <= 48) return "PW"; if (d >= 49 && d <= 53) return "GW"; if (d >= 54 && d <= 57) return "SW"; if (d >= 58 && d <= 64) return "LW"; }
  return String(name || "").trim();
}

// Merges distances (from a photo or the estimate) into the bag, keeping clubs the student added.
export function mergeInto(bag, found, { onlyEmpty = false } = {}) {
  const out = bag.map(c => ({ ...c }));
  let n = 0;
  for (const f of found) {
    const name = normalizeClub(f.club);
    if (!name || (!f.carry && !f.total)) continue;
    let row = out.find(c => c.club.toLowerCase() === name.toLowerCase());
    if (!row) { row = { club: name, carry: "", total: "", on: true }; out.push(row); }
    if (onlyEmpty && row.carry) continue;
    if (f.carry) row.carry = String(Math.round(+f.carry));
    if (f.total) row.total = String(Math.round(+f.total));
    row.on = true; n++;
  }
  return { bag: sortBag(out), count: n };
}

const order = name => { const i = BAG_CLUBS.findIndex(([c]) => c === name); if (i >= 0) return i; const m = name.match(/^(\d)\s*(wood|hybrid|iron)/); return m ? BAG_CLUBS.length + +m[1] : 99; };
export const sortBag = bag => bag.slice().sort((a, b) => order(a.club) - order(b.club));

// Clubs in the bag with a carry, longest first.
export const carried = bag => (bag || []).filter(c => c.on !== false && +c.carry > 0).map(c => ({ ...c, carry: +c.carry })).sort((a, b) => b.carry - a.carry);

// Gaps that are too big (a missing club) or too small (two clubs doing one job).
export function gapNotes(bag) {
  const c = carried(bag), notes = [];
  for (let i = 1; i < c.length; i++) {
    const gap = c[i - 1].carry - c[i].carry;
    if (gap >= 20) notes.push(`${gap} yds between your ${c[i - 1].club} and ${c[i].club}. That's a big gap; ask Karina about it.`);
    else if (gap <= 4) notes.push(`Your ${c[i - 1].club} and ${c[i].club} go about the same distance (${gap} yds apart).`);
  }
  return notes;
}

// The clubs closest to a distance, for hints on the course.
export function clubsFor(bag, yds) {
  const c = carried(bag), y = +yds;
  if (!y || !c.length) return [];
  return c.slice().sort((a, b) => Math.abs(a.carry - y) - Math.abs(b.carry - y)).slice(0, 2).sort((a, b) => b.carry - a.carry);
}

// ---------- Wedge system (clock): backswing length × wedge = carry
export const SWINGS = [["730", "7:30"], ["900", "9:00"], ["1030", "10:30"], ["full", "Full"]];
const SHARE = { "730": 0.45, "900": 0.66, "1030": 0.83, full: 1 }; // typical share of a full wedge's carry
export const WEDGES = ["PW", "GW", "SW", "LW"];

// Starting setup for each swing length. Students (or Karina) change it to match their lessons.
export const DEFAULT_SETUP = {
  "730": { face: "square", ball: "center", grip: "down2", stance: "narrow" },
  "900": { face: "square", ball: "center", grip: "down1", stance: "narrow" },
  "1030": { face: "square", ball: "center", grip: "down1", stance: "normal" },
  full: { face: "square", ball: "center", grip: "normal", stance: "normal" }
};
export const SETUP_OPTS = {
  face: [["square", "Square"], ["open", "Open"]],
  ball: [["back", "Back"], ["center", "Center"], ["forward", "Forward"]],
  grip: [["normal", "Normal"], ["down1", "Down 1 in"], ["down2", "Down 2 in"]],
  stance: [["narrow", "Narrow"], ["normal", "Normal"]]
};

export function newWedges(bag) {
  const inBag = (bag || []).filter(c => c.on !== false && WEDGES.includes(c.club)).map(c => c.club);
  const clubs = inBag.length ? WEDGES.filter(w => inBag.includes(w)) : WEDGES.slice(0, 3);
  return { rows: clubs.map(club => ({ club, d: { "730": "", "900": "", "1030": "", full: "" } })), setup: JSON.parse(JSON.stringify(DEFAULT_SETUP)) };
}

// Fills empty cells from each wedge's full carry (from the cell or from the bag).
export function estimateWedges(w, bag) {
  const full = club => +(w.rows.find(r => r.club === club)?.d.full) || +((bag || []).find(c => c.club === club)?.carry) || 0;
  let n = 0;
  const rows = w.rows.map(r => {
    const f = full(r.club); if (!f) return r;
    const d = { ...r.d };
    for (const [k] of SWINGS) if (!d[k]) { d[k] = String(Math.round(f * SHARE[k])); n++; }
    return { ...r, d };
  });
  return { wedges: { ...w, rows }, count: n };
}

// The wedge swings closest to a distance (for hints inside 120 yards).
export function wedgeFor(w, yds) {
  const y = +yds; if (!w || !y || y > 125) return [];
  const all = [];
  (w.rows || []).forEach(r => SWINGS.forEach(([k, l]) => { if (+r.d?.[k] > 0) all.push({ club: r.club, swing: l, carry: +r.d[k] }); }));
  return all.sort((a, b) => Math.abs(a.carry - y) - Math.abs(b.carry - y)).slice(0, 2);
}
