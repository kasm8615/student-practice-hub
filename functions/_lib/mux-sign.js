// Signs short-lived Mux playback tokens (RS256 JWT) with the Web Crypto API.
// Cloudflare variables needed (Secret): MUX_SIGNING_KEY_ID, MUX_SIGNING_PRIVATE_KEY
// Both come from Mux → Settings → Signing Keys → Generate new key (paste the private key exactly as Mux shows it).

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const utf8 = s => new TextEncoder().encode(s);

// DER length bytes.
function derLen(n) {
  if (n < 0x80) return [n];
  const bytes = [];
  for (let x = n; x > 0; x = Math.floor(x / 256)) bytes.unshift(x & 255);
  return [0x80 | bytes.length, ...bytes];
}

// Mux gives a PKCS#1 key ("BEGIN RSA PRIVATE KEY"); Web Crypto only imports PKCS#8, so wrap it.
function pkcs1ToPkcs8(pkcs1) {
  const rsaOid = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...derLen(pkcs1.length)];
  const inner = [0x02, 0x01, 0x00, ...rsaOid, ...octet];
  const total = inner.length + pkcs1.length;
  return Uint8Array.from([0x30, ...derLen(total), ...inner, ...pkcs1]);
}

const keyCache = new Map();
async function importKey(privateKey) {
  if (keyCache.has(privateKey)) return keyCache.get(privateKey);
  let pem = privateKey.trim();
  if (!pem.includes("BEGIN")) pem = atob(pem.replace(/\s+/g, "")); // Mux shows the key base64-encoded
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", isPkcs1 ? pkcs1ToPkcs8(der) : der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  keyCache.set(privateKey, key);
  return key;
}

// aud: "v" video, "t" thumbnail. ttlSeconds: how long the link works.
export async function signMuxToken({ keyId, privateKey, playbackId, aud, ttlSeconds }) {
  const header = { alg: "RS256", typ: "JWT", kid: keyId };
  const payload = { sub: playbackId, aud, exp: Math.floor(Date.now() / 1000) + ttlSeconds, kid: keyId };
  const input = `${b64url(utf8(JSON.stringify(header)))}.${b64url(utf8(JSON.stringify(payload)))}`;
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await importKey(privateKey), utf8(input));
  return `${input}.${b64url(sig)}`;
}
