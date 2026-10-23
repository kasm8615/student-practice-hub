# Student Practice Hub · setup

The app is a small website. Students and parents sign in with an emailed 6-digit code. Karina signs in the same way with karina@karinagolfcoaching.com and gets the coach view.

| Piece | Service | Plan |
| --- | --- | --- |
| Code | GitHub, private repo `student-practice-hub` | Free |
| Sign-in, database, privacy rules | Supabase project `ksg-app` | Free |
| Sign-in emails | Resend, connected to Supabase as SMTP | Free |
| Hosting at app.karinagolfcoaching.com | Cloudflare Pages | Free |

## 1. Database (Supabase)

1. Supabase → project `ksg-app` → **SQL Editor** → **New query**.
2. Paste all of `supabase/schema.sql` and click **Run**. It is safe to run again after updates.
3. That creates the tables, the privacy rules (each student sees only their own space; parents see their children's) and sets karina@karinagolfcoaching.com as the coach.

## 2. Sign-in emails

**Authentication → Emails → Templates.** Change both **Confirm signup** and **Magic Link** so the email shows the code:

- Subject: `Your Practice Hub code`
- Body:

```html
<h2>Your sign-in code</h2>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Enter this code in the Student Practice Hub. It expires in 1 hour.</p>
<p>– Karina Sánchez Golf</p>
```

**Authentication → Emails → SMTP Settings** (turn on custom SMTP), with values from Resend after the domain is verified:

- Sender email: `hub@karinagolfcoaching.com` · Sender name: `Karina Sánchez Golf`
- Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: a Resend API key

**Authentication → Rate Limits:** raise "emails sent per hour" to about 30.

**Authentication → URL Configuration:** Site URL `https://app.karinagolfcoaching.com`.

## 3. Hosting (Cloudflare Pages)

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pick `student-practice-hub`.
2. Build command `npm run build` · Output directory `dist`.
3. Environment variables (from Supabase → Project Settings → API):
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key (safe to share; the privacy rules protect the data)
   - `NODE_VERSION` = `22`
4. Deploy. Then **Custom domains** → add `app.karinagolfcoaching.com` and follow the DNS instructions.

Every change pushed to GitHub redeploys automatically.

## Using it

- Add a student in the coach view with their email (adults) or a parent's email (juniors), then click **Invite** and send the text.
- Archive a student in Edit profile when they stop lessons. Their sign-in stops working and their history stays.
- Never share the Supabase **service_role** key or the database password. The app doesn't need them.

## Preview on sample data

`VITE_DEMO=1 npm run dev`, then open `/?as=coach` or `/?as=student`. Nothing is saved.

## Video uploads (Mux)

Videos upload straight from a phone to Mux, which converts them so they play on any device.

1. mux.com → sign up → **Settings → Access Tokens → Generate new token**, environment **Production**, permission **Mux Video: Read and Write**.
2. Cloudflare → student-practice-hub → **Settings → Variables and Secrets** → add, as type **Secret**:
   - `MUX_TOKEN_ID` = the Access Token ID
   - `MUX_TOKEN_SECRET` = the Secret Key
3. Videos are **private** (signed playback). mux.com → **Settings → Signing Keys → Generate new key** (environment **Production**). Add two more Cloudflare secrets:
   - `MUX_SIGNING_KEY_ID` = the key's ID
   - `MUX_SIGNING_PRIVATE_KEY` = the private key, pasted exactly as Mux shows it
4. Redeploy (any new push to GitHub does it).

The upload endpoint is `functions/api/video.js`. Only signed-in coaches and invited students can create uploads.
Playback goes through `functions/api/play.js`, which hands out links that expire (thumbnails after 1 hour, video after 6) and only for videos the signed-in person can see. Videos uploaded before this change are public until they are re-uploaded or deleted in Mux.

## Email alerts when students post

Karina gets an email when a student sends a note, a swing video or logs a round.

1. Resend → **API Keys → Create API Key** (Sending access) → Cloudflare secret `RESEND_API_KEY`.
2. Make up a long random string → Cloudflare secret `NOTIFY_SECRET`.
3. Supabase SQL Editor → run `supabase/notify.sql` with `PASTE_NOTIFY_SECRET` replaced by that same string.
4. Redeploy. The endpoint is `functions/api/notify.js`.

## Update 2: goals, practice log, emails to students

Supabase SQL Editor → run `supabase/update-2.sql` (no values to replace; it uses the notify secret already saved).

- Students get a **Goals** tab (3- and 6-month score, performance, mental and practice-habit goals, plus a score calculator based on Break X Golf's averages from 3,788 amateur rounds). Karina adds a note from the student's Goals tab.
- Students log practice sessions from Home or the Plan tab. Karina sees them under **Practice log** and in the check-in.
- Emails: Karina gets one when a student logs practice or sets goals. Students (and parents) get one when Karina sends a note or video, or logs a lesson. Replies go to Karina.

## Practice games (optional AI)

Students tap **Get a practice game** (Home) or **Practice games** (Plan). They pick where they are, how long they have and what to work on; the app builds a session from the library in `src/lib/scenarios.js` (range, short game, putting, on-course and mental games, with targets for three levels). "Pick for me" uses their biggest stat gap from logged rounds, or their goals.

To switch on **✨ Tailor to me** (personal tips and targets written by Claude):
1. console.anthropic.com → sign up → add a small credit (e.g. $5) → **API Keys → Create Key**.
2. Cloudflare → student-practice-hub → **Settings → Variables and Secrets** → add `ANTHROPIC_API_KEY` as type **Secret**.
3. Redeploy (any push). Each tailored session costs well under 1 cent. Without the key, the button simply doesn't show.

## Hole-by-hole round tracking

Rounds → **Track a round hole by hole**. Quick mode: score, putts, fairway, penalties. Full mode adds tee-shot miss and start line (started on target and curved, or started off target), approach distance, club and miss direction, chip landing spot or bunker result, first-putt distance, penalty source and recovery shots. Progress is saved on the phone after every tap and can be resumed. On finish the app saves totals, the hole-by-hole card and the miss patterns (`src/lib/roundstats.js`), and the AI review uses them.

## Club distances (update 3)

Supabase SQL Editor → run `supabase/update-3.sql`. Students open Rounds → **My club distances** (or the menu). They can read distances from a photo (needs `ANTHROPIC_API_KEY`), estimate from their 7 iron, or type them. Karina sees the table and gap warnings on the student's Overview. The round tracker shows the closest clubs for the distance typed in.

## Update 4 (security fixes)

Supabase SQL Editor → run `supabase/update-4.sql`. A brand-new database runs, in order: `schema.sql`, `notify.sql` (with the secret), `update-2.sql`, `update-3.sql`, `update-4.sql`.

## Update 5: pictures and PDFs in notes (and 30-second videos)

Supabase SQL Editor → run `supabase/update-5.sql` (no values to replace). It creates a private storage bucket `practice-files` and the rules for who can read and add files.

- Students and Karina can attach a picture or PDF (up to 10 MB) to a note, alongside or instead of a video.
- Student videos are limited to 30 seconds. The app checks the length on the phone before uploading, and the server removes any longer clip students post. The note form tells students about both limits.
- Files and videos are visible only to Karina and the student's own space (the student and any parent who signs in for them). Deleting a note also deletes its picture or PDF.
- No new Cloudflare settings are needed. Redeploy (any push to GitHub).

## Update 6: shot pattern (dispersion)

Supabase SQL Editor → run `supabase/update-6.sql` (no values to replace). It adds the `pattern` entry type and lets students save and delete their own sessions.

- Students open Rounds → **My shot pattern** (or Plan → **Shot pattern**).
- **Range test:** one club, one target, 10 balls. **Game mode:** three clubs, a different one every ball, 15 balls.
- After each ball they tap where it finished, rate the contact 1 to 5, and for poor strikes (1–2) pick thin, fat, toe or heel. If they can't judge the distance they pick short, pin high or long instead; left and right still come from the tap.
- The pattern shows the spread oval, average miss, left-to-right and short-to-long spread, contact, and plain tips. Fewer than 20 shots with a club is labelled "Early read", and aim advice waits for 10 shots.
- **On course** shows approach misses from hole-by-hole rounds as percentages (rounds record short/long/left/right, not exact spots).
- Karina sees each club's pattern on the student's Overview.

## Update 7: the practice version (newsletter sign-ups)

Anyone with the newsletter link can create a free practice-version account. Karina's coached students keep everything as before.

1. **Database:** Supabase SQL Editor → run `supabase/update-7.sql` (no values to replace).
2. **Pick a sign-up code** (a word, e.g. `founders`) and run this one line in the SQL Editor with your word in place of `founders`:
   `update private.settings set value = 'founders' where key = 'join_code';`
   Until this is set, sign-ups stay closed. To close sign-ups later, or start a new group, run it again with a new word.
3. **The newsletter link** is `https://app.karinagolfcoaching.com/?join=founders` (same word as step 2).
4. **Sign-in emails:** every new sign-up gets a code email through Resend. Resend's free plan sends 100 emails a day, so upgrade before a big newsletter goes out.
5. Redeploy (merge the pull request).

What newsletter sign-ups get:
- Practice games, shot dealer, shot pattern, round tracking and stats, goals, club distances and the practice log. No lessons, notes, video or AI.
- A "Founding golfer" label, a welcome card, and a **Work with Karina** button.
- Their stats are **private by default**. They can switch "Let Karina see my stats" on or off in the menu. Asking to work with Karina turns it on.
- They must confirm they're 18 or older. They can delete their account and all their data from the menu.

What Karina sees:
- Check-in → **Practice app**: sign-ups, how many used it this week, rounds and practices logged, and how many share with her (totals only).
- Golfers who share appear in the roster with a **Practice app** label (filter: Practice app).
- **Coaching requests** (with their note and email) show on the check-in, and Karina gets an email. **Make my student** turns them into a coached student with the full app; **Dismiss** clears the request.
- No emails about practice-version users' rounds or practice.
