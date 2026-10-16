// Cloudflare Pages Function: /api/play
// POST { pids: ["<mux playback id>", ...] }  (signed-in coach or student)
// Returns short-lived Mux tokens, but only for videos the signed-in person is allowed to see:
// we look the playback id up in the entries table *as that person*, so the database's
// row-level security decides (a student only gets their own videos, Karina gets all).
//
// Cloudflare variables (Secret): MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_SIGNING_KEY_ID, MUX_SIGNING_PRIVATE_KEY,
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (already set)
import { signMuxToken } from "../_lib/mux-sign.js";

const VIDEO_TTL = 6 * 60 * 60; // 6 hours: long enough to watch a lesson without it expiring mid-play
const THUMB_TTL = 60 * 60;     // 1 hour

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function onRequestPost({ request, env }) {
  if (!env.MUX_SIGNING_KEY_ID || !env.MUX_SIGNING_PRIVATE_KEY || !env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) {
    return json({ error: "Private video isn't set up yet (Mux signing key missing)." }, 503);
  }
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Please sign in again." }, 401);
  const base = String(env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const anon = String(env.VITE_SUPABASE_ANON_KEY || "").trim();

  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad request." }, 400); }
  const pids = [...new Set((Array.isArray(body.pids) ? body.pids : []).filter(p => typeof p === "string" && /^[A-Za-z0-9]{10,80}$/.test(p)))].slice(0, 50);
  if (!pids.length) return json({ tokens: {} });

  // Which of these videos can this person see? (Row-level security answers, using their own sign-in.)
  const q = `${base}/rest/v1/entries?select=pid:data->>video_pid&data->>video_pid=in.(${pids.join(",")})`;
  const res = await fetch(q, { headers: { apikey: anon, authorization: auth } });
  if (res.status === 401 || res.status === 403) return json({ error: "Please sign in again." }, 401);
  if (!res.ok) return json({ error: "Couldn't check access." }, 502);
  const allowed = new Set((await res.json()).map(r => r.pid));

  const basic = btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`);
  const tokens = {};
  await Promise.all(pids.filter(p => allowed.has(p)).map(async pid => {
    // Older videos were uploaded as public; they have no token. New ones are signed.
    const info = await fetch(`https://api.mux.com/video/v1/playback-ids/${pid}`, { headers: { authorization: `Basic ${basic}` } });
    if (!info.ok) return;
    const policy = (await info.json()).data?.policy;
    if (policy !== "signed") { tokens[pid] = { signed: false }; return; }
    const common = { keyId: env.MUX_SIGNING_KEY_ID, privateKey: env.MUX_SIGNING_PRIVATE_KEY, playbackId: pid };
    tokens[pid] = {
      signed: true,
      video: await signMuxToken({ ...common, aud: "v", ttlSeconds: VIDEO_TTL }),
      thumb: await signMuxToken({ ...common, aud: "t", ttlSeconds: THUMB_TTL }),
      videoExp: Date.now() + VIDEO_TTL * 1000,
      thumbExp: Date.now() + THUMB_TTL * 1000
    };
  }));
  return json({ tokens });
}
