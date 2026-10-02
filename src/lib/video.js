// Video upload and playback, shared by the coach view and the student app.
import { api } from "./store.js";
import { esc } from "./util.js";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

export const thumbUrl = pid => `https://image.mux.com/${encodeURIComponent(pid)}/thumbnail.jpg?width=480&fit_mode=smartcrop&time=1`;

// A tappable thumbnail. Any element with data-play opens the player (see bindPlayer).
export function videoThumb(pid, label = "Watch video") {
  if (!pid) return "";
  return `<button type="button" class="vthumb" data-play="${esc(pid)}" aria-label="${esc(label)}">
    <img src="${thumbUrl(pid)}" alt="" loading="lazy"><span class="vplay" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg></span><span class="vlabel">${esc(label)}</span></button>`;
}

// Full-screen player, loaded only when someone presses play.
export async function openPlayer(pid) {
  const wrap = document.createElement("div");
  wrap.className = "vmodal";
  wrap.innerHTML = `<div class="vmodal-inner" role="dialog" aria-modal="true" aria-label="Video"><button type="button" class="vclose" aria-label="Close video">✕</button><div class="vstage"><p style="color:#fff">Loading video…</p></div></div>`;
  document.body.appendChild(wrap);
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.addEventListener("click", e => { if (e.target === wrap || e.target.closest(".vclose")) close(); });
  await import("@mux/mux-player");
  const p = document.createElement("mux-player");
  p.setAttribute("playback-id", pid);
  p.setAttribute("stream-type", "on-demand");
  p.setAttribute("accent-color", "#4B9CD3");
  p.setAttribute("autoplay", "");
  p.setAttribute("playsinline", "");
  p.setAttribute("default-show-remaining-time", "");
  p.setAttribute("playback-rates", "0.25 0.5 1");
  wrap.querySelector(".vstage").replaceChildren(p);
}

// Call once per app root: any [data-play] click opens the player.
export function bindPlayer(root) {
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-play]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    openPlayer(b.dataset.play);
  }, true);
}

// Uploads a file and waits until Mux can play it. onState(text, percent) reports progress.
export async function uploadVideo(file, onState) {
  if (!file.type.startsWith("video/")) throw new Error("That file isn't a video.");
  if (file.size > MAX_BYTES) throw new Error("That video is over 1 GB. Trim it on your phone first.");
  onState("Starting upload…", 0);
  const { uploadId, url } = await api.videoStart();
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onState("Uploading…", Math.round(e.loaded / e.total * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload didn't finish. Check your connection and try again.")));
    xhr.onerror = () => reject(new Error("The upload didn't finish. Check your connection and try again."));
    xhr.send(file);
  });
  onState("Processing video…", 100);
  const started = Date.now();
  let pid = null;
  while (Date.now() - started < 5 * 60 * 1000) {
    await new Promise(r => setTimeout(r, 2500));
    const st = await api.videoStatus(uploadId);
    if (st.playbackId) pid = st.playbackId;
    if (st.status === "ready" && pid) return pid;
    if (st.status === "errored") throw new Error("Mux couldn't process that video. Try a different file.");
  }
  if (pid) return pid; // still processing; it will play in a few minutes
  throw new Error("Processing is taking a long time. Try again in a few minutes.");
}

// A form control: current video (if any), an upload button and a remove button.
// Returns a controller with .value (playback id or "") and .busy.
export function videoField(container, initialPid, { label = "Upload video" } = {}) {
  const ctl = { value: initialPid || "", busy: false };
  const id = "vf-" + Math.random().toString(36).slice(2, 8);
  function render(state) {
    container.innerHTML = `<div class="vfield">
      ${ctl.value && !state ? `${videoThumb(ctl.value, "Play")}<button type="button" class="vbtn" data-vremove="1">Remove video</button>` : ""}
      ${state ? `<div class="vprog"><span>${esc(state.text)}</span><div class="vbar"><i style="width:${state.pct}%"></i></div></div>` : `
      <label class="vbtn primary" for="${id}">${ctl.value ? "Replace video" : esc(label)}</label>
      <input id="${id}" type="file" accept="video/*" hidden>`}
      ${state?.error ? `<p class="verr">${esc(state.error)}</p>` : ""}
    </div>`;
    const input = container.querySelector(`#${id}`);
    if (input) input.addEventListener("change", async () => {
      const f = input.files[0];
      if (!f) return;
      ctl.busy = true;
      try {
        ctl.value = await uploadVideo(f, (text, pct) => render({ text, pct }));
        ctl.busy = false; render();
      } catch (err) {
        ctl.busy = false; render();
        const p = document.createElement("p"); p.className = "verr"; p.textContent = err.message; container.querySelector(".vfield").appendChild(p);
      }
    });
    const rm = container.querySelector("[data-vremove]");
    if (rm) rm.addEventListener("click", () => { ctl.value = ""; render(); });
  }
  render();
  return ctl;
}
