// Pictures and PDFs attached to notes. Files live in a private Supabase Storage bucket
// ("practice-files"), in a folder named after the student. Storage rules (supabase/update-5.sql)
// let only Karina and that student's signed-in people read or add files there.
import { supabase } from "./supabase.js";
import { esc, toast } from "./util.js";

const BUCKET = "practice-files";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const LINK_TTL = 60 * 60;           // signed links last an hour

export const isPdf = f => f?.file_kind === "pdf";

// Uploads one picture or PDF for a student. Returns the fields to store on the note.
export async function uploadFile(file, studentId, onState) {
  const isImage = file.type.startsWith("image/");
  const isPdfFile = file.type === "application/pdf";
  if (!isImage && !isPdfFile) throw new Error("Pictures and PDFs only.");
  if (file.size > MAX_BYTES) throw new Error("That file is over 10 MB. Try a smaller picture or PDF.");
  onState("Uploading…", 0);
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "file";
  const path = `${studentId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("The upload didn't finish. Check your connection and try again.");
  onState("Done", 100);
  return { file_path: path, file_name: file.name, file_kind: isPdfFile ? "pdf" : "image" };
}

// Short-lived link to one file. Cached briefly so redraws don't ask again.
const linkCache = new Map(); // path -> { url, exp }
export async function fileUrl(path) {
  const hit = linkCache.get(path);
  if (hit && hit.exp > Date.now() + 60 * 1000) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, LINK_TTL);
  if (error || !data?.signedUrl) throw new Error("Couldn't open that file.");
  linkCache.set(path, { url: data.signedUrl, exp: Date.now() + LINK_TTL * 1000 });
  return data.signedUrl;
}

// Removes a file when Karina deletes the note it was attached to. Failures are ignored: the note is already gone.
export async function removeFile(path) {
  try { await supabase.storage.from(BUCKET).remove([path]); } catch { /* ignore */ }
}

// What a note shows for its attachment: a picture thumbnail, or a PDF link. Empty if none.
export function fileBlock(n, label = "Picture") {
  if (!n.file_path) return "";
  if (isPdf(n)) return `<button type="button" class="filechip" data-file="${esc(n.file_path)}">PDF · ${esc(n.file_name || "Open PDF")}</button>`;
  return `<button type="button" class="vthumb fthumb" data-file="${esc(n.file_path)}" aria-label="${esc(label)}"><img data-file-img="${esc(n.file_path)}" alt="" loading="lazy"><span class="vlabel">${esc(label)}</span></button>`;
}

// Hooks up attachment clicks and fills in picture thumbnails. Called once per app root (see bindPlayer).
export function bindFiles(root) {
  const hydrate = async () => {
    const imgs = [...root.querySelectorAll("img[data-file-img]:not([src])")];
    for (const img of imgs) {
      try { img.src = await fileUrl(img.dataset.fileImg); } catch { /* try again on the next redraw */ }
    }
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; hydrate(); });
  }).observe(root, { childList: true, subtree: true });
  root.addEventListener("click", async e => {
    const b = e.target.closest("[data-file]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    // Open the tab first so phones don't block it as a pop-up.
    const win = window.open("", "_blank");
    try {
      const url = await fileUrl(b.dataset.file);
      if (win) win.location.href = url; else window.location.href = url;
    } catch {
      if (win) win.close();
      toast("Couldn't open that file. Try again.");
    }
  }, true);
}

// A form control for attaching one picture or PDF. Same shape as videoField:
// returns a controller with .value ({ file_path, file_name, file_kind } or null) and .busy.
export function fileField(container, studentId, initial = null, { label = "Attach picture or PDF" } = {}) {
  const ctl = { value: initial || null, busy: false };
  const id = "ff-" + Math.random().toString(36).slice(2, 8);
  function render(state) {
    container.innerHTML = `<div class="vfield">
      ${ctl.value && !state ? `<span class="filechip static">${isPdf(ctl.value) ? "PDF" : "Picture"} · ${esc(ctl.value.file_name)}</span><button type="button" class="vbtn" data-fremove="1">Remove file</button>` : ""}
      ${state ? `<div class="vprog"><span>${esc(state.text)}</span></div>` : `
      <label class="vbtn primary" for="${id}">${ctl.value ? "Replace file" : esc(label)}</label>
      <input id="${id}" type="file" accept="image/*,application/pdf" hidden>`}
      ${state?.error ? `<p class="verr">${esc(state.error)}</p>` : ""}
    </div>`;
    const input = container.querySelector(`#${id}`);
    if (input) input.addEventListener("change", async () => {
      const f = input.files[0];
      if (!f) return;
      ctl.busy = true;
      try {
        ctl.value = await uploadFile(f, studentId, (text, pct) => render({ text, pct }));
        ctl.busy = false; render();
      } catch (err) {
        ctl.busy = false; render();
        const p = document.createElement("p"); p.className = "verr"; p.textContent = err.message; container.querySelector(".vfield").appendChild(p);
      }
    });
    const rm = container.querySelector("[data-fremove]");
    if (rm) rm.addEventListener("click", () => { ctl.value = null; render(); });
  }
  render();
  return ctl;
}
