// Cloudflare Pages Function: /api/notify
// Called by the database (see supabase/notify.sql) when a student posts something.
// Emails the coach through Resend.
//
// Cloudflare variables (Settings → Variables and Secrets), type Secret:
//   RESEND_API_KEY  – a Resend API key with sending access
//   NOTIFY_SECRET   – the same random string used in supabase/notify.sql
// Optional: COACH_EMAIL (defaults to karina@karinagolfcoaching.com)

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function onRequestPost({ request, env }) {
  if (!env.NOTIFY_SECRET || request.headers.get("x-notify-secret") !== env.NOTIFY_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!env.RESEND_API_KEY) return new Response("Resend key missing", { status: 503 });

  let p;
  try { p = await request.json(); } catch { return new Response("Bad request", { status: 400 }); }
  const name = p.student_name || "A student";
  const first = String(name).split(/\s+/)[0];
  const d = p.data || {};
  const app = "https://app.karinagolfcoaching.com";

  let subject, lead, detail = "";
  if (p.type === "note" && d.video_pid) {
    subject = `${first} sent you a swing video`;
    lead = `${esc(name)} sent you a swing video${d.text ? " with a note" : ""}.`;
    if (d.text) detail = `<p style="font-size:16px;background:#F2F7FC;border-left:4px solid #4B9CD3;padding:10px 14px;margin:16px 0">${esc(d.text)}</p>`;
    detail += `<p><img src="https://image.mux.com/${encodeURIComponent(d.video_pid)}/thumbnail.jpg?width=480" width="320" alt="Swing video" style="border-radius:10px;max-width:100%"></p>`;
  } else if (p.type === "note") {
    subject = `New note from ${first}`;
    lead = `${esc(name)} sent you a note.`;
    detail = `<p style="font-size:16px;background:#F2F7FC;border-left:4px solid #4B9CD3;padding:10px 14px;margin:16px 0">${esc(d.text)}</p>`;
  } else if (p.type === "stat") {
    subject = `${first} logged a round: ${d.score ?? "?"}`;
    lead = `${esc(name)} logged a ${esc(d.event || "round")}${d.course ? ` at ${esc(d.course)}` : ""}.`;
    const bits = [["Score", d.score], ["Holes", d.holes], ["Putts", d.putts], ["Fairways", d.fairways], ["Greens", d.gir]].filter(([, v]) => v !== "" && v != null);
    detail = `<p style="font-size:16px;margin:16px 0">${bits.map(([k, v]) => `<b>${k}:</b> ${esc(v)}`).join(" &nbsp;·&nbsp; ")}</p>`;
    if (d.notes) detail += `<p style="font-size:15px;background:#F2F7FC;border-left:4px solid #4B9CD3;padding:10px 14px">${esc(d.notes)}</p>`;
  } else {
    return new Response("Ignored", { status: 200 });
  }

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;color:#13294B;max-width:520px">
    <p style="font-size:17px;margin:0 0 4px">${lead}</p>${detail}
    <p style="margin:20px 0"><a href="${app}" style="background:#2A77AD;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;display:inline-block">Open Golfers Practice Hub</a></p>
    <p style="font-size:12px;color:#7A8CA5">You get this email when a student posts in the app.</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "Golfers Practice Hub <hub@karinagolfcoaching.com>",
      to: [env.COACH_EMAIL || "karina@karinagolfcoaching.com"],
      subject,
      html
    })
  });
  return new Response(res.ok ? "Sent" : "Email failed", { status: res.ok ? 200 : 502 });
}
