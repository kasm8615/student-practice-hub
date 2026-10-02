import { api } from "./lib/store.js";
import { esc, friendly, logo } from "./lib/util.js";
import { quoteOfTheDay } from "./lib/quotes.js";

// Two screens: enter email, then enter the code from the email.
export function showSignIn(root, onSignedIn) {
  let email = "";
  let error = "";
  let busy = false;

  const shell = inner => `<div class="auth"><div class="auth-inner">
    <div>${logo("auth-logo")}<div class="mark">Karina Sánchez Golf</div><h1>${inner.title}</h1><div class="flagline"></div><p class="quote">“${esc(quoteOfTheDay())}”<span>– Karina</span></p></div>
    ${inner.card}</div></div>`;

  function emailScreen() {
    root.innerHTML = shell({
      title: "Golfers<br>Practice Hub",
      card: `<form class="auth-card" id="emailForm" novalidate>
        <label for="email">Your email</label>
        <input id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="${esc(email)}" required>
        ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
        <button class="big" type="submit" ${busy ? "disabled" : ""}>${busy ? "Sending…" : "Send my code"}</button>
        <p class="hint">Use the email Karina has on file. Parents of junior players: use your own email.</p>
      </form>`
    });
    const input = root.querySelector("#email");
    input.focus();
    root.querySelector("#emailForm").addEventListener("submit", async e => {
      e.preventDefault();
      email = input.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error = "Enter a full email address, like name@email.com."; emailScreen(); return; }
      busy = true; error = ""; emailScreen();
      try { await api.sendCode(email); busy = false; codeScreen(); }
      catch (err) { busy = false; error = friendly(err); emailScreen(); }
    });
  }

  function codeScreen() {
    root.innerHTML = shell({
      title: "Check your<br>email",
      card: `<form class="auth-card" id="codeForm" novalidate>
        <label for="code">Enter the code we sent to ${esc(email)}</label>
        <input id="code" class="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="••••••" required>
        ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
        <button class="big" type="submit" ${busy ? "disabled" : ""}>${busy ? "Signing in…" : "Sign in"}</button>
        <p class="hint">Enter the code from the email, or just tap the sign-in link in it. Can't find it? Check your spam folder.</p>
        <button class="linkbtn" type="button" id="resend">Send a new code</button>
        <button class="linkbtn" type="button" id="back">Use a different email</button>
      </form>`
    });
    const input = root.querySelector("#code");
    input.focus();
    root.querySelector("#back").onclick = () => { error = ""; emailScreen(); };
    root.querySelector("#resend").onclick = async () => {
      try { await api.sendCode(email); error = ""; codeScreen(); root.querySelector(".hint").textContent = "New code sent."; }
      catch (err) { error = friendly(err); codeScreen(); }
    };
    root.querySelector("#codeForm").addEventListener("submit", async e => {
      e.preventDefault();
      const token = input.value.replace(/\D/g, "");
      if (token.length < 6) { error = "Enter all the digits from the email."; codeScreen(); return; }
      busy = true; error = ""; codeScreen();
      try { await api.verifyCode(email, token); busy = false; onSignedIn(); }
      catch (err) { busy = false; error = friendly(err); codeScreen(); }
    });
  }

  emailScreen();
}
