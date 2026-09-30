// In-memory stand-in for the database, used only for previews (VITE_DEMO=1).
// Open with ?as=coach or ?as=student to pick who is signed in.
import { today } from "./util.js";

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const dayOffset = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const S1 = "s-alex", S2 = "s-sofia", S3 = "s-marcus";
const db = {
  students: [
    { id: S1, name: "Alex Rivera", email: "alex@example.com", grp: "Adult", handicap: "16.4", program: "Lesson package", start_date: "2026-06-02", next_lesson: dayOffset(2), goals: "Break 85 by spring. Cut 3-putts to 2 or fewer per round.", coach_notes: "Early extension. Watch lower back.", archived: false },
    { id: S2, name: "Sofia Morales", guardian_email: "parent@example.com", grp: "Junior", handicap: "9.8", program: "Private lessons", start_date: "2026-03-10", goals: "Make the high school team.", archived: false },
    { id: S3, name: "Marcus Lee", email: "marcus@example.com", grp: "Adult", handicap: "22.0", program: "Group clinic", start_date: "2026-08-01", goals: "Consistent contact with irons.", archived: false }
  ],
  entries: [],
  scores: [],
  seen: { [S1]: now(), [S2]: dayOffset(-1) + "T12:00:00Z", [S3]: dayOffset(-9) + "T12:00:00Z" }
};
const add = (student_id, type, data, author = "coach") => {
  const e = { id: uid(), student_id, type, author, created_by: author === "coach" ? "coach" : "me", created_at: now(), updated_at: now(), data };
  db.entries.push(e); return e;
};
const ladder = add(S1, "drill", { name: "Putting ladder", category: "Putting", status: "In progress", goal: 8, of: 10, target: "putts finish within a club length past the hole", notes: "Putt from 3, 6, 9 and 12 ft, then back down. Every putt has to finish past the hole but inside a club length.", video: "https://www.youtube.com/" });
const chair = add(S1, "drill", { name: "Chair drill", category: "Full swing", status: "In progress", goal: 8, of: 10, target: "swings with your glutes touching the chair", notes: "Set a chair just behind you at address. Keep your glutes on it through impact." });
const clock = add(S1, "drill", { name: "Wedge clock", category: "Pitching", status: "Assigned", goal: 7, of: 10, target: "shots land within 5 yards of your number", notes: "10 balls with your 56 at 7:30, 9:00 and 10:30." });
add(S1, "drill", { name: "Gate drill", category: "Putting", status: "Mastered", goal: 20, of: 20, target: "putts in a row through the gate", notes: "Two tees just wider than your putter head." });
add(S1, "lesson", { date: dayOffset(-12), kind: "Private lesson", focus: "Early extension with driver", notes: "Hips moving toward the ball in transition. Worked on the chair drill and the lead-hip-back feel.", homework: "Chair drill, 3 x 10 slow swings before each range session." });
add(S1, "lesson", { date: dayOffset(-26), kind: "Playing lesson", focus: "Wedge distances inside 100", notes: "Built a clock system with the 56 and 60.", homework: "Log carry for each clock position, 10 balls each." });
[["Mon", "Putting", "Putting ladder", "3, 6, 9, 12 ft", 30, ladder.id, true],
 ["Wed", "Full swing", "Range: chair drill", "Driver and 7 iron, 3 x 10 slow", 45, chair.id, false],
 ["Wed", "Mental", "Pre-shot routine", "Breathe, pick a target, one swing thought", 10, "", false],
 ["Thu", "Fitness", "TPI mobility", "Dead bugs, 90/90 stretch", 20, "", false],
 ["Fri", "Short game", "Wedge clock", "7:30, 9:00, 10:30 with the 56", 30, clock.id, false],
 ["Sat", "On course", "9 holes, play it forward", "Track putts and up & downs", 60, "", false]
].forEach(([day, area, title, details, minutes, drill, done]) => add(S1, "plan", { day, area, title, details, minutes, drill, done }));
add(S1, "stat", { date: dayOffset(-10), event: "Casual", course: "Charlotte Golf Links", holes: "18", score: 87, fairways: "8/14", gir: 6, putts: 33 }, "student");
add(S1, "stat", { date: dayOffset(-31), event: "Practice round", course: "Renaissance Park", holes: "18", score: 89, fairways: "7/14", gir: 5, putts: 34 });
add(S1, "stat", { date: dayOffset(-52), event: "Casual", course: "Renaissance Park", holes: "18", score: 92, fairways: "6/14", gir: 4, putts: 36 });
add(S1, "fitness", { date: dayOffset(-100), kind: "TPI screen", name: "Pelvic rotation", result: "Needs work" });
add(S1, "fitness", { date: dayOffset(-100), kind: "Exercise", name: "Open books", result: "Assigned", dose: "2 x 10 each side", notes: "Before every practice." });
add(S1, "note", { text: "Great session Thursday. Keep the chair drill slow, speed comes later." });
add(S1, "note", { text: "My back felt tight after the range on Sunday, is that normal?" }, "student");
db.scores.push({ id: uid(), student_id: S1, drill_id: ladder.id, score: 5, out_of: 10, scored_on: dayOffset(-14) }, { id: uid(), student_id: S1, drill_id: ladder.id, score: 6, out_of: 10, scored_on: dayOffset(-7) }, { id: uid(), student_id: S1, drill_id: chair.id, score: 4, out_of: 10, scored_on: dayOffset(-8) });
[["Mon", "Putting", "Lag putting circle", 30, true], ["Tue", "Full swing", "Alignment sticks", 45, true], ["Thu", "Mental", "Visualize 18 holes", 15, true], ["Sat", "On course", "Tournament prep round", 90, false]]
  .forEach(([day, area, title, minutes, done]) => add(S2, "plan", { day, area, title, minutes, done }));
[["Tue", "Full swing", "Half swings, 7 iron", 40, false], ["Thu", "Short game", "Chipping ladder", 30, false]]
  .forEach(([day, area, title, minutes, done]) => add(S3, "plan", { day, area, title, minutes, done }));

const flat = r => ({ ...r.data, id: r.id, type: r.type, student_id: r.student_id, author: r.author, created_by: r.created_by, created_at: r.created_at, updated_at: r.updated_at });
const role = new URLSearchParams(location.search).get("as") || "coach";
let signedIn = true;
const listeners = new Set();
const ping = () => setTimeout(() => listeners.forEach(f => f()), 30);

export const demoApi = {
  async whoami() { return role === "coach" ? { role: "coach", students: [] } : { role: "student", students: [{ id: S1, name: "Alex Rivera" }] }; },
  async touchSeen() {},
  async sendCode() {},
  async verifyCode() { signedIn = true; },
  async signOut() { signedIn = false; },
  async user() { return signedIn ? { id: "me", email: role === "coach" ? "karina@karinagolfcoaching.com" : "alex@example.com" } : null; },
  async listStudents() { return db.students.slice().sort((a, b) => a.name.localeCompare(b.name)); },
  async studentProfile(id) { const s = db.students.find(x => x.id === id); if (!s) return null; const { coach_notes, email, guardian_email, archived, ...rest } = s; return rest; },
  async addStudent(d) { const s = { id: uid(), archived: false, ...d }; db.students.push(s); return s; },
  async updateStudent(id, d) { const s = db.students.find(x => x.id === id); Object.assign(s, d); return s; },
  async deleteStudent(id) { db.students = db.students.filter(s => s.id !== id); db.entries = db.entries.filter(e => e.student_id !== id); },
  async lastSeen() { return Object.entries(db.seen).map(([student_id, last_seen]) => ({ student_id, last_seen })); },
  async entries(sid) { return db.entries.filter(e => e.student_id === sid).map(flat); },
  async entriesOfType(t) { return db.entries.filter(e => e.type === t).map(flat); },
  async addEntry(sid, type, data) { const e = add(sid, type, { ...data }, role === "coach" ? "coach" : "student"); ping(); return flat(e); },
  async updateEntry(entry, patch) { const e = db.entries.find(x => x.id === entry.id); const d = { ...entry, ...patch }; ["id", "type", "student_id", "author", "created_by", "created_at", "updated_at"].forEach(k => delete d[k]); e.data = d; e.updated_at = now(); ping(); return flat(e); },
  async deleteEntry(id) { db.entries = db.entries.filter(e => e.id !== id); ping(); },
  async setPlanDone(id, done) { const e = db.entries.find(x => x.id === id); e.data = { ...e.data, done, done_at: done ? now() : null }; ping(); },
  async scores(sid) { return db.scores.filter(s => !sid || s.student_id === sid); },
  async addScore(student_id, drill_id, score, out_of, scored_on) { const s = { id: uid(), student_id, drill_id, score, out_of, scored_on: scored_on || today() }; db.scores.push(s); ping(); return s; },
  async deleteScore(id) { db.scores = db.scores.filter(s => s.id !== id); ping(); },
  watch(_ids, fn) { listeners.add(fn); return () => listeners.delete(fn); }
};
