import { api } from "./lib/store.js";
import { esc, friendly, logo } from "./lib/util.js";
import { quoteOfTheDay } from "./lib/quotes.js";

// Newsletter sign-up link: ?join=CODE. Kept for the visit so the code screen and reloads still know it.
function joinCode() {
  const q = new URLSearchParams(location.search).get("join");
  try { if (q) sessionStorage.setItem("sph.join", q); return q || sessionStorage.getItem("sph.join") || ""; } catch { return q || ""; }
}

// Two screens: enter email, then enter the code from the email.
// With a newsletter link, the first screen is a short sign-up for the practice version instead.
export function showSignIn(root, onSignedIn) {
  let email = "";
  let error = "";
  let busy = false;
  const join = joinCode();
  let mode = join ? "join" : "signin";
  const J = { name: "", adult: false, share: false };

  const shell = inner => `<div class="auth"><div class="auth-inner">
    <div>${logo("auth-logo")}<h1>${inner.title}</h1><div class="flagline"></div><p class="quote">“${esc(quoteOfTheDay())}”</p></div>
    ${inner.card}</div></div>`;

  function joinScreen() {
    root.innerHTML = shell({
      title: "You're<br>in early",
      card: `<form class="auth-card" id="joinForm" novalidate>
        <p class="join-lead">Welcome, founding golfer. This is the practice app I built for my own students: practice games, a shot pattern test and round stats that tell you what to work on next. It's free.</p>
        <label for="j-name">First name</label>
        <input id="j-name" autocomplete="given-name" placeholder="Your first name" value="${esc(J.name)}" maxlength="40">
        <label for="email">Your email</label>
        <input id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="${esc(email)}" required>
        <label class="check"><input type="checkbox" id="j-adult" ${J.adult ? "checked" : ""}><span>I'm 18 or older</span></label>
        <label class="check"><input type="checkbox" id="j-share" ${J.share ? "checked" : ""}><span>Let Karina see my stats so she can send me tips<small>Optional. You can change it any time.</small></span></label>
        ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
        <button class="big" type="submit" ${busy ? "disabled" : ""}>${busy ? "Sending…" : "Get my sign-in code"}</button>
        <p class="hint">We'll email you a 6-digit code. No password to remember. Your stats stay private unless you tick the box above.</p>
        <button class="linkbtn" type="button" id="toSignin">Already have an account? Sign in</button>
        <a class="privacy-link" href="/privacy.html" target="_blank" rel="noopener">Privacy</a>
      </form>`
    });
    root.querySelector("#j-name").focus();
    root.querySelector("#toSignin").onclick = () => { mode = "signin"; error = ""; emailScreen(); };
    root.querySelector("#joinForm").addEventListener("submit", async e => {
      e.preventDefault();
      J.name = root.querySelector("#j-name").value.trim();
      J.adult = root.querySelector("#j-adult").checked;
      J.share = root.querySelector("#j-share").checked;
      email = root.querySelector("#email").value.trim().toLowerCase();
      if (!J.name) { error = "Add your first name."; joinScreen(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error = "Enter a full email address, like name@email.com."; joinScreen(); return; }
      if (!J.adult) { error = "The practice app is for golfers 18 and older."; joinScreen(); return; }
      busy = true; error = ""; joinScreen();
      try { await api.sendCode(email, { join, name: J.name, adult: true, share: J.share }); busy = false; codeScreen(); }
      catch (err) {
        busy = false;
        const m = String(err?.message || err);
        error = /not_invited|Database error saving new user|Signups not allowed/i.test(m) ? "This sign-up link has closed. Use the link in Karina's latest newsletter." : friendly(err);
        joinScreen();
      }
    });
  }

  function emailScreen() {
    if (mode === "join") { joinScreen(); return; }
    root.innerHTML = shell({
      title: "Golfers<br>Practice Hub",
      card: `<form class="auth-card" id="emailForm" novalidate>
        <label for="email">Your email</label>
        <input id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="${esc(email)}" required>
        ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
        <button class="big" type="submit" ${busy ? "disabled" : ""}>${busy ? "Sending…" : "Send my code"}</button>
        <p class="hint">Use the email Karina has on file. Parents of junior players: use your own email.</p>
        ${join ? `<button class="linkbtn" type="button" id="toJoin">New here? Sign up</button>` : ""}
        <a class="privacy-link" href="/privacy.html" target="_blank" rel="noopener">Privacy</a>
      </form>`
    });
    const tj = root.querySelector("#toJoin"); if (tj) tj.onclick = () => { mode = "join"; error = ""; joinScreen(); };
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
