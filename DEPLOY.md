# Altus Pipeline — Deploy Guide

This folder is the complete, ready-to-host site. It's a static site (no build step):
`index.html` + `supabase-config.js` + `tweaks-panel.jsx` + the `app/` folder.

Data and login run on Supabase (configured in `supabase-config.js`). Google Maps is
already wired with your key.

---

## Option A — Fastest, no GitHub (Cloudflare Pages direct upload)

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets**.
2. Name it (e.g. `altus-pipeline`), then **drag this entire `deploy` folder's contents**
   (not the folder itself — select index.html, supabase-config.js, tweaks-panel.jsx, and
   the app/ folder) into the uploader.
3. Click **Deploy**. You'll get a URL like `https://altus-pipeline.pages.dev`.

(Netlify works the same way: https://app.netlify.com/drop — drag the contents in.)

## Option B — GitHub private repo + auto-deploy

1. On github.com → **New repository** → name it, set **Private** → Create.
2. On the repo page, click **uploading an existing file** and drag in everything from
   this `deploy` folder (index.html, supabase-config.js, tweaks-panel.jsx, app/). Commit.
3. In Cloudflare Pages → **Create** → **Pages** → **Connect to Git** → pick the repo →
   Framework preset **None**, build command **empty**, output dir **/** → **Save and Deploy**.
4. Every future push to the repo auto-deploys.

---

## After it's live (important)

1. **Lock the Google Maps key to your domain.** Google Cloud Console → APIs & Services →
   Credentials → your key → Application restrictions → **HTTP referrers** → add
   `https://YOUR-DOMAIN/*` (and the `*.pages.dev/*` URL). This stops anyone else using
   your key on your bill.
2. **Add users.** Supabase → Authentication → Users → Add user (email + password,
   check "Auto Confirm User"). Each person logs in and sees the same live pipeline + contacts.
3. **Custom domain** (optional): Cloudflare Pages → your project → **Custom domains** →
   add e.g. `pipeline.altusequity.com`.

## Notes
- `supabase-config.js` holds your Supabase URL + publishable key and the Google Maps key.
  These are safe in the browser (Supabase Row-Level Security + login protect the data).
- To temporarily disable the login wall, set `REQUIRE_LOGIN: false` in `supabase-config.js`.
- AI document parsing (OM/T-12/Rent Roll auto-fill) stays off until you wire an Anthropic
  API proxy — see the commented `ALTUS_AI` block in `supabase-config.js`. Manual entry works.
