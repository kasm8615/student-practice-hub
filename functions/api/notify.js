// Cloudflare Pages Function: /api/notify
// Called by the database (see supabase/notify.sql) when someone posts:
//   direction "to_coach"   – a student sent a note or video, logged a round or practice, or set goals
//   direction "to_student" – the coach sent a note or video, or logged a lesson
// Sends the email through Resend.
// The database only sends the id of the new entry; we ask it (using the shared secret) for the real
// recipients and text, so a leaked secret can only re-send emails that already exist (see supabase/update-5.sql).
//
// Cloudflare variables (Settings → Variables and Secrets), type Secret:
//   RESEND_API_KEY  – a Resend API key with sending access
//   NOTIFY_SECRET   – the same random string saved in supabase/notify.sql
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  – already set for the app
// Optional: COACH_EMAIL (defaults to karina@karinagolfcoaching.com)

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const APP = "https://app.karinagolfcoaching.com";
const quote = t => `<p style="font-size:16px;background:#F2F7FC;border-left:4px solid #4B9CD3;padding:10px 14px;margin:16px 0;white-space:pre-wrap">${esc(t)}</p>`;
// Videos are private, so emails never include a picture or link to the video itself.
const thumb = () => `<p style="font-size:16px;margin:16px 0">\u{1F4F9} A video is waiting in the app.</p>`;
const facts = bits => `<p style="font-size:16px;margin:16px 0">${bits.filter(([, v]) => v !== "" && v != null && !(Array.isArray(v) && !v.length)).map(([k, v]) => `<b>${k}:</b> ${esc(Array.isArray(v) ? v.join(", ") : v)}`).join(" &nbsp;·&nbsp; ")}</p>`;
const RATING = ["", "Rough", "Meh", "OK", "Good", "Great"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = d => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${MON[+m[2] - 1]} ${+m[3]}` : ""; };

// Email to Karina about something a student posted.
function toCoach(p) {
  const name = p.student_name || "A student";
  const first = String(name).split(/\s+/)[0];
  const d = p.data || {};
  if (p.type === "note" && d.video_pid) {
    return { subject: `${first} sent you a swing video`, lead: `${esc(name)} sent you a swing video${d.text ? " with a note" : ""}.`, detail: (d.text ? quote(d.text) : "") + thumb(d.video_pid) };
  }
  if (p.type === "note") return { subject: `New note from ${first}`, lead: `${esc(name)} sent you a note.`, detail: quote(d.text) };
  if (p.type === "stat") {
    return { subject: `${first} logged a round: ${d.score ?? "?"}`, lead: `${esc(name)} logged a ${esc(d.event || "round")}${d.course ? ` at ${esc(d.course)}` : ""}.`,
      detail: facts([["Score", d.score], ["Holes", d.holes], ["Putts", d.putts], ["Fairways", d.fairways], ["Greens", d.gir]]) + (d.notes ? quote(d.notes) : "") };
  }
  if (p.type === "session") {
    return { subject: `${first} logged practice${d.minutes ? `: ${d.minutes} min` : ""}`, lead: `${esc(name)} logged a practice session.`,
      detail: facts([["Minutes", d.minutes], ["Worked on", d.areas], ["How it went", RATING[+d.rating] || ""]]) + (d.worked ? quote(d.worked) : "") + (d.went ? quote(d.went) : "") + (d.next ? quote("Next time: " + d.next) : "") };
  }
  if (p.type === "goal") {
    const g = d.m3 || {};
    const lines = [["Score", g.score], ["Performance", g.perf], ["Mental", g.mental], ["Practice habit", g.process]].filter(([, v]) => v);
    return { subject: `${first} set their goals`, lead: `${esc(name)} wrote their goals. Here are the 3-month goals; open the app to see all of them and add your note.`,
      detail: lines.map(([k, v]) => `<p style="margin:10px 0"><b>${k}:</b> ${esc(v)}</p>`).join("") };
  }
  return null;
}

// Email to the student (and parent) about something Karina posted.
function toStudent(p) {
  const first = String(p.student_name || "").split(/\s+/)[0];
  const forWho = first ? ` for ${esc(first)}` : "";
  const d = p.data || {};
  if (p.type === "note" && d.video_pid) {
    return { subject: "Karina sent you a video", lead: `Karina sent a video${forWho}${d.text ? " with a note" : ""}.`, detail: (d.text ? quote(d.text) : "") + thumb(d.video_pid) };
  }
  if (p.type === "note") return { subject: "New note from Karina", lead: `Karina sent a note${forWho}.`, detail: quote(d.text) };
  if (p.type === "lesson") {
    return { subject: "Your lesson notes are ready", lead: `Karina added notes from ${d.date ? "the " + day(d.date) : "your"} lesson${forWho}${d.focus ? `: <b>${esc(d.focus)}</b>` : ""}.`,
      detail: (d.homework ? quote("Homework: " + d.homework) : "") + (d.video_pid ? thumb(d.video_pid) : "") };
  }
  return null;
}

const sameSecret = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export async function onRequestPost({ request, env }) {
  if (!env.NOTIFY_SECRET || !sameSecret(request.headers.get("x-notify-secret"), env.NOTIFY_SECRET)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!env.RESEND_API_KEY) return new Response("Resend key missing", { status: 503 });

  let body;
  try { body = await request.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const entryId = String(body?.entry_id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entryId)) return new Response("Bad request", { status: 400 });

  // Look up who to email and what to say from the database itself, never from the request.
  const base = String(env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anon = String(env.VITE_SUPABASE_ANON_KEY || "").trim();
  const look = await fetch(`${base}/rest/v1/rpc/notify_payload`, {
    method: "POST",
    headers: { apikey: anon, authorization: `Bearer ${anon}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: env.NOTIFY_SECRET, p_entry: entryId })
  });
  if (!look.ok) return new Response("Lookup failed", { status: 502 });
  const p = await look.json();
  if (!p) return new Response("Ignored", { status: 200 });
  const coach = env.COACH_EMAIL || "karina@karinagolfcoaching.com";
  const toStu = p.direction === "to_student";
  const msg = toStu ? toStudent(p) : toCoach(p);
  if (!msg) return new Response("Ignored", { status: 200 });

  const valid = e => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const to = toStu ? (Array.isArray(p.recipients) ? p.recipients.filter(valid).slice(0, 5) : []) : [coach];
  if (!to.length) return new Response("No recipients", { status: 200 });

  const footer = toStu ? "You get this email when Karina posts in your Golfers Practice Hub. Reply to this email to answer Karina." : "You get this email when a student posts in the app.";
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;color:#13294B;max-width:520px">
    <p style="font-size:17px;margin:0 0 4px">${msg.lead}</p>${msg.detail}
    <p style="margin:20px 0"><a href="${APP}" style="background:#2A77AD;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;display:inline-block">Open Golfers Practice Hub</a></p>
    <p style="font-size:12px;color:#7A8CA5">${footer}</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "Golfers Practice Hub <hub@karinagolfcoaching.com>",
      to,
      ...(toStu ? { reply_to: coach } : {}),
      subject: msg.subject,
      html
    })
  });
  return new Response(res.ok ? "Sent" : "Email failed", { status: res.ok ? 200 : 502 });
}
