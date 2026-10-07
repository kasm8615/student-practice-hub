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
3. Redeploy (any new push to GitHub does it).

The upload endpoint is `functions/api/video.js`. Only signed-in coaches and invited students can create uploads.

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
