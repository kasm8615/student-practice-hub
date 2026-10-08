import { supabase } from "./supabase.js";

const META = ["id", "type", "student_id", "author", "created_by", "created_at", "updated_at"];
const flat = r => ({ ...r.data, id: r.id, type: r.type, student_id: r.student_id, author: r.author, created_by: r.created_by, created_at: r.created_at, updated_at: r.updated_at });
const strip = d => { const o = { ...d }; META.forEach(k => delete o[k]); return o; };
const must = ({ data, error }) => { if (error) throw error; return data; };

export const api = {
  // ---- session
  async whoami() { return must(await supabase.rpc("whoami")); },
  async touchSeen() { await supabase.rpc("touch_seen"); },
  async sendCode(email) { must(await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })); },
  async verifyCode(email, token) { return must(await supabase.auth.verifyOtp({ email, token, type: "email" })); },
  async signOut() { await supabase.auth.signOut(); },
  async user() { return (await supabase.auth.getUser()).data.user; },

  // ---- students
  async listStudents() { return must(await supabase.from("students").select("*").order("name")); },
  async studentProfile(id) { return must(await supabase.from("students_public").select("*").eq("id", id).maybeSingle()); },
  async addStudent(d) { return must(await supabase.from("students").insert(d).select().single()); },
  async updateStudent(id, d) { return must(await supabase.from("students").update(d).eq("id", id).select().single()); },
  async deleteStudent(id) { must(await supabase.from("students").delete().eq("id", id)); },
  async lastSeen() { return must(await supabase.rpc("last_seen_by_student")); },

  // ---- entries
  async entries(studentId) {
    return must(await supabase.from("entries").select("*").eq("student_id", studentId).order("created_at")).map(flat);
  },
  async entriesOfType(type) {
    return must(await supabase.from("entries").select("*").eq("type", type)).map(flat);
  },
  async addEntry(studentId, type, data) {
    return flat(must(await supabase.from("entries").insert({ student_id: studentId, type, data: strip(data) }).select().single()));
  },
  async updateEntry(entry, patch) {
    const data = strip({ ...entry, ...patch });
    return flat(must(await supabase.from("entries").update({ data }).eq("id", entry.id).select().single()));
  },
  async deleteEntry(id) { must(await supabase.from("entries").delete().eq("id", id)); },
  async setPlanDone(id, done) { must(await supabase.rpc("set_plan_done", { entry_id: id, is_done: done })); },

  // ---- drill scores
  async scores(studentId) {
    let q = supabase.from("drill_scores").select("*").order("scored_on").order("created_at");
    if (studentId) q = q.eq("student_id", studentId);
    return must(await q);
  },
  async addScore(studentId, drillId, score, outOf, scoredOn) {
    return must(await supabase.from("drill_scores").insert({ student_id: studentId, drill_id: drillId, score, out_of: outOf, scored_on: scoredOn }).select().single());
  },
  async deleteScore(id) { must(await supabase.from("drill_scores").delete().eq("id", id)); },

  // ---- video (Mux, through the /api/video function)
  async videoStart() {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch("/api/video", { method: "POST", headers: { authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Couldn't start the upload.");
    return body;
  },
  async videoStatus(uploadId) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/video?upload=${encodeURIComponent(uploadId)}`, { headers: { authorization: `Bearer ${token}` } });
    return res.json().catch(() => ({ status: "unknown" }));
  },

  // ---- AI-tailored practice games (through the /api/scenario function)
  async tailorAvailable() {
    const res = await fetch("/api/scenario");
    if (!res.ok) return false;
    return !!(await res.json().catch(() => ({}))).ai;
  },
  async tailorSession(payload) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch("/api/scenario", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Couldn't tailor right now.");
    return body;
  },

  // ---- live updates: calls onChange whenever entries or scores change for these students
  watch(studentIds, onChange) {
    const ch = supabase.channel("changes-" + Math.random().toString(36).slice(2));
    const filter = studentIds && studentIds.length === 1 ? `student_id=eq.${studentIds[0]}` : undefined;
    ["entries", "drill_scores"].forEach(table =>
      ch.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, onChange));
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  }
};
