# 💰 Finio

![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Plaid](https://img.shields.io/badge/Plaid-111111?style=flat-square&logo=plaid&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

> **Finio** is a personal finance dashboard that turns bank transactions into clarity. Connect accounts via Plaid sandbox, track budgets and goals, spot subscriptions, and dig into cash flow, net worth, and spending insights.

---

## Features

### Core
* **Google Sign-In** — NextAuth OAuth (no passwords).
* **Plaid bank sync** — Link sandbox banks, sync transactions (webhooks + manual refresh), encrypted access tokens at rest.
* **Cash flow dashboard** — Money in/out, savings rate, avg daily spend; optional custom date range. **Transfers**, **credit-card payments**, and the **Income** category are excluded from spend; merchant refunds (negative non-income amounts) net against spend instead of inflating income.
* **Budgets** — Category limits with progress bars and **month-to-month rollover** of unused budget.
* **Savings goals** — Targets with progress from cash flow **plus manual contributions**.
* **Alerts** — Dashboard banner for over-budget / nearing limit, goal deadlines, and behind-pace; dismissible per alert.
* **Spending charts** — Daily / weekly / monthly / yearly timeline (spent vs income).
* **Dark mode** — Persisted in local storage.
* **CSV export** — Filtered transactions or **tax-year category summary**.

### Insights (`/insights`)
* Weekly spending digest (vs last week, highlights, top merchants).
* Merchant spend search (“You spent $X at …”).
* Month comparison (vs last month / same month last year).
* Recurring / subscriptions (weekly, monthly, annual) with yearly cost.
* Bill calendar (upcoming charges from recurring patterns).
* Runway / what-if (cancel subscriptions → projected months of runway).
* Spending heatmap (day-of-week + top merchants).
* Accounts & net worth chart (from Plaid balances + snapshots).

### Transactions & automation
* Manual entries, split transactions, locked categories (survive Plaid sync).
* Notes, tags, receipt upload.
* **Category rules** (e.g. “Amazon → Shopping”) applied on sync — manage in Settings.
* Credit-card payment detection (auto + manual toggle) to avoid double-counting.

### Settings
* Reconnect / disconnect Plaid.
* Category rules CRUD + “Apply all”.
* Re-categorize all transactions to Finio’s standard categories.
* Email weekly digest (requires SMTP — see below).

---

## Quick start

```bash
cd Finio
npm install

cp client/.env.example client/.env.local
cp server/.env.example server/.env

# Terminal 1
npm run dev:server

# Terminal 2
npm run dev:client
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google, connect a Plaid sandbox bank (`user_good` / `pass_good`), then explore Dashboard, Insights, Transactions, and Settings.

---

## Configuration

Create `client/.env.local` and `server/.env` from the examples.

**`server/.env` (required):**

```env
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/finio
NEXTAUTH_SECRET=your-long-random-secret

PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_secret
PLAID_ENV=sandbox
```

**`server/.env` (optional):**

```env
TOKEN_ENCRYPTION_KEY=another-long-random-secret
PLAID_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/plaid/webhook

# Weekly digest email (Settings → Email weekly digest)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=Finio <you@gmail.com>
```

**`client/.env.local`:**

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-long-random-secret
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Setup notes

* **Google OAuth:** [Google Cloud Console](https://console.cloud.google.com/) — redirect URI `http://localhost:3000/api/auth/callback/google`.
* **MongoDB:** Atlas free tier or local; collections are created on first use.
* **Plaid sandbox:** any institution + `user_good` / `pass_good`.
* **NEXTAUTH_SECRET:** must be identical in client and server.

---

## Email digests (SMTP)

Digest email is **optional**. Without SMTP, Insights still shows the weekly digest in-app; Settings → “Email weekly digest” returns a clear “SMTP not configured” message.

### Gmail (easiest for local/dev)

1. Turn on [2-Step Verification](https://myaccount.google.com/security) for the Google account.
2. Create an [App Password](https://myaccount.google.com/apppasswords) (App = Mail).
3. Add to `server/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=Finio <your.email@gmail.com>
```

4. Restart the API server.
5. Open **Settings** → **Email weekly digest**. Mail goes to the signed-in Google account email.

### Other providers

Use that provider’s SMTP host/port and credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`). Set `SMTP_SECURE=true` if the provider requires TLS on port 465.

---

## Tech stack

* **Client:** Next.js (App Router), React, Tailwind, Recharts, Sonner
* **Server:** Express, TypeScript, Mongoose
* **DB:** MongoDB
* **Auth:** NextAuth (Google) + JWT for API
* **Finance:** Plaid (transactions + account balances)

Architecture details: **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)**.

---

## Plaid sandbox tips

* Credentials: `user_good` / `pass_good`.
* Webhooks: ngrok → port 5000, set `PLAID_WEBHOOK_URL` to `…/api/plaid/webhook`.
* If balances fail with `ITEM_LOGIN_REQUIRED`, reconnect under **Settings**.
* Live banks need Plaid Development/Production approval — sandbox is enough for demos.

---

## Deploy

* **Client:** Vercel — set env vars; Google redirect = `https://your-domain/api/auth/callback/google`.
* **Server:** Render/Railway — match `NEXTAUTH_SECRET`, set `CLIENT_URL` to the frontend origin, register Plaid webhook URL.
* Prefer waiting until you have a stable custom domain so OAuth/CORS/webhook URLs don’t churn.

---

## Security

* Never commit `.env` files.
* Rotate secrets if exposed.
* Plaid access tokens are encrypted at rest (AES-256-GCM).
* Receipt uploads are stored under `server/uploads/` (gitignored).
