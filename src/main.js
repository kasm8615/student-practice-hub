import "./base.css";
import { api, ready } from "./lib/store.js";
import { showSignIn } from "./auth.js";
import { esc } from "./lib/util.js";

const root = document.getElementById("app");

function message(title, body, withSignOut) {
  root.innerHTML = `<div class="center-msg"><div><h2>${esc(title)}</h2><p>${body}</p>
    ${withSignOut ? `<button class="big" id="so" style="max-width:220px">Sign out</button>` : ""}</div></div>`;
  if (withSignOut) root.querySelector("#so").onclick = async () => { await api.signOut(); boot(); };
}

async function boot() {
  if (!ready) {
    message("Almost there", "The app isn't connected to its database yet. Add the Supabase keys in Cloudflare (see SETUP.md).");
    return;
  }
  const user = await api.user();
  if (!user) { showSignIn(root, boot); return; }
  let who;
  try { who = await api.whoami(); }
  catch { message("Can't connect", "Check your internet connection and reload the page.", true); return; }

  if (who.role === "coach") {
    const m = await import("./coach/coach.js");
    m.start(root, { onSignOut: boot });
  } else if (who.role === "student") {
    const m = await import("./student/student.js");
    m.start(root, { students: who.students, email: user.email, onSignOut: boot });
  } else {
    message("No active space", "Your email isn't linked to a current student. If you're taking lessons, ask Karina to check your email in the app.", true);
  }
}

boot();
