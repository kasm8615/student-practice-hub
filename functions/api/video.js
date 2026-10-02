// Cloudflare Pages Function: /api/video
// POST  -> creates a Mux direct-upload URL for a signed-in coach or student
// GET   ?upload=<id> -> reports the upload's status and, once ready, its playback id
//
// Needs these Cloudflare variables (Settings → Variables and Secrets):
//   MUX_TOKEN_ID, MUX_TOKEN_SECRET  (secret)
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (already set for the app)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function signedInRole(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const url = String(env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const key = String(env.VITE_SUPABASE_ANON_KEY || "").trim();
  const res = await fetch(`${url}/rest/v1/rpc/whoami`, {
    method: "POST",
    headers: { apikey: key, authorization: auth, "content-type": "application/json" },
    body: "{}"
  });
  if (!res.ok) return null;
  const who = await res.json();
  return who && (who.role === "coach" || who.role === "student") ? who.role : null;
}

function mux(env, path, init = {}) {
  const basic = btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`);
  return fetch(`https://api.mux.com${path}`, {
    ...init,
    headers: { authorization: `Basic ${basic}`, "content-type": "application/json", ...(init.headers || {}) }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.MUX_TOKEN_ID || !env.MUX_TOKEN_SECRET) return json({ error: "Video uploads aren't set up yet (Mux keys missing)." }, 503);
  const role = await signedInRole(request, env);
  if (!role) return json({ error: "Please sign in again." }, 401);
  const origin = new URL(request.url).origin;
  const res = await mux(env, "/video/v1/uploads", {
    method: "POST",
    body: JSON.stringify({
      cors_origin: origin,
      new_asset_settings: { playback_policy: ["public"], video_quality: "basic", max_resolution_tier: "1080p" }
    })
  });
  if (!res.ok) return json({ error: "Couldn't start the upload. Try again." }, 502);
  const { data } = await res.json();
  return json({ uploadId: data.id, url: data.url });
}

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("upload");
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return json({ error: "Missing upload id." }, 400);
  const role = await signedInRole(request, env);
  if (!role) return json({ error: "Please sign in again." }, 401);
  const up = await mux(env, `/video/v1/uploads/${id}`);
  if (!up.ok) return json({ status: "unknown" });
  const upload = (await up.json()).data;
  if (upload.status === "errored") return json({ status: "errored" });
  if (!upload.asset_id) return json({ status: "uploading" });
  const as = await mux(env, `/video/v1/assets/${upload.asset_id}`);
  if (!as.ok) return json({ status: "processing" });
  const asset = (await as.json()).data;
  const pid = (asset.playback_ids || []).find(p => p.policy === "public")?.id;
  return json({ status: asset.status === "ready" ? "ready" : asset.status === "errored" ? "errored" : "processing", playbackId: pid || null, duration: asset.duration || null });
}
