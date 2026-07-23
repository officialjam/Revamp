# Career Copilot

A career profile manager plus AI resume/cover-letter generator, application
tracker, and a chat assistant for interview prep, LinkedIn posts, and career
advice. Next.js 16 (App Router) + React 19.

Ported from a Claude.ai artifact prototype. Two things changed for a real
deployment:

- **Storage**: the artifact used Claude's built-in `window.storage`. This
  version uses the browser's `localStorage` instead — same behavior (your
  profile persists between visits), but it's local to *your browser*, not
  synced across devices. If you outgrow that, swap the `storage` object near
  the top of `components/CareerCopilotApp.js` for calls to a real database.
- **Model calls**: the artifact could call Claude directly because Claude.ai
  injected credentials for it. A real app can never put an API key in
  browser code — anyone could open dev tools and steal it. So the browser
  now calls this app's own `/api/anthropic` route, and *that* server-side
  route holds the real key and calls Anthropic. The key never reaches the
  browser.

## 1. Run it locally

```bash
npm install
cp .env.local.example .env.local
```

Open `.env.local` and paste in a real key from
[console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys):

```
ANTHROPIC_API_KEY=sk-ant-...
```

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `.env.local` is already
in `.gitignore`, so your key won't get committed.

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "Career Copilot"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

(Create the empty repo on GitHub first if you haven't — no README/license,
since this already has one.)

## 3. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repo
   you just pushed. Framework preset should auto-detect as Next.js.
2. Before the first deploy (or right after, then redeploy), go to
   **Settings → Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your real key
   - Apply to Production, Preview, and Development
3. Deploy. Vercel builds and gives you a live URL.

If you add the env var *after* the first deploy, trigger a redeploy
(**Deployments → ⋯ → Redeploy**) — Vercel doesn't pick up new env vars on
already-built deployments.

## Costs

This calls the Claude API on generation and in Ask Copilot, which is
pay-per-use on your Anthropic account — check
[console.anthropic.com](https://console.anthropic.com) for current pricing
and to fund the account. There's no per-user limit built into this app, so if
you ever make it public, add your own rate limiting in
`app/api/anthropic/route.js`.

## Project structure

```
app/
  layout.js              — root HTML shell
  page.js                — renders the app
  api/anthropic/route.js — server-side proxy to Anthropic (holds the API key)
components/
  CareerCopilotApp.js     — the whole app (profile, generate, applications, chat)
```

## Changing the model

The model is set server-side in `app/api/anthropic/route.js`
(`model: "claude-sonnet-5"`). Change it there if you want a different Claude
model — see [docs.claude.com](https://docs.claude.com) for current model
names and pricing.
