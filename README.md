# 💰 Finio

![Next.js](https://img.shields.io/badge/Next.js-black?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Plaid](https://img.shields.io/badge/Plaid-111111?style=flat-square&logo=plaid&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

> **Finio** is a personal finance dashboard that turns bank transactions into clarity. Connect your account via Plaid, track budgets and savings goals, spot recurring subscriptions from your own history, and see cash flow at a glance — with optional dark mode for late-night money check-ins.

---

## ✨ Features

* 🔐 **Google Sign-In** Secure authentication with NextAuth — no passwords to manage.
* 🏦 **Plaid Bank Sync** Link a sandbox bank, sync transactions automatically (webhooks + manual refresh), with encrypted access tokens at rest.
* 📊 **Cash Flow Dashboard** Money in vs money out this month, savings rate %, average daily spend, and lifetime net position — all computed from data you already have.
* 🔁 **Recurring & Subscriptions** Detects merchants that repeat monthly or weekly (Netflix, gym, etc.) from transaction patterns — no subscription APIs required.
* 🎯 **Savings Goals** Set targets like “Save $2,000 by December” with progress bars driven by income minus spending since the goal was created.
* 📈 **Budgets & Charts** Editable category budgets with progress bars, spending timeline charts (daily / weekly / monthly / yearly), and category breakdowns.
* 🌙 **Dark Mode** Toggle in the nav bar; preference persists in local storage.
* 📤 **CSV Export** Download filtered transactions for spreadsheets or tax prep.

---

## 🚀 Quick Start

Get up and running locally in just a few steps:

```bash
# From the Finio directory
cd Finio

# Install dependencies (client + server workspaces)
npm install

# Copy environment templates
cp client/.env.example client/.env.local
cp server/.env.example server/.env

# Start backend (port 5000) and frontend (port 3000) in separate terminals
npm run dev:server
npm run dev:client
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Sign in with Google, connect a Plaid sandbox bank, and explore the dashboard.

---

## 🔑 Configuration & API Keys

The app needs Google OAuth, MongoDB, Plaid sandbox credentials, and a shared JWT secret. Create `client/.env.local` and `server/.env` from the examples.

**Example `server/.env`:**

```env
# ==========================================
# FINIO Server Environment
# ==========================================

PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/finio

# Must match client NEXTAUTH_SECRET
NEXTAUTH_SECRET=your-long-random-secret

# Plaid Sandbox — https://dashboard.plaid.com/
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_secret
PLAID_ENV=sandbox

# Optional: encrypt Plaid tokens (falls back to NEXTAUTH_SECRET)
TOKEN_ENCRYPTION_KEY=another-long-random-secret

# Optional: Plaid webhooks (use ngrok locally)
PLAID_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/plaid/webhook
```

**Example `client/.env.local`:**

```env
# ==========================================
# FINIO Client Environment
# ==========================================

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-long-random-secret

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Setup notes

* **Google OAuth:** Create credentials in [Google Cloud Console](https://console.cloud.google.com/). Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
* **MongoDB:** Use Atlas free tier or a local instance; the app creates collections on first use.
* **Plaid sandbox:** Use `user_good` / `pass_good` when linking any sandbox institution.
* **NEXTAUTH_SECRET:** Must be identical in client and server so API JWT verification works.

---

## 💻 Tech Stack

* **Framework:** Next.js (App Router)
* **UI:** React, Tailwind CSS, Recharts, Sonner toasts
* **Backend:** Express.js, TypeScript, Mongoose
* **Database:** MongoDB
* **Auth:** NextAuth.js (Google OAuth) + JWT for API
* **Finance:** Plaid (transaction sync)

---

## 📐 System design

For architecture, data models, and how recurring detection / goals / cash flow work under the hood, see **[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)**.

---

## 🧪 Plaid sandbox tips

* Pick any sandbox bank in Link; credentials are `user_good` / `pass_good`.
* For automatic re-sync via webhooks, expose port 5000 with ngrok and set `PLAID_WEBHOOK_URL`.
* Production Plaid requires approval for live financial institutions.

---

## 🚢 Deploy

* **Client:** Vercel — set all `client/.env` vars and production Google redirect URI.
* **Server:** Render, Railway, or similar — set `server/.env`, allow CORS to your Vercel URL, register webhook URL in Plaid.

---

## 🔒 Security

* Never commit `.env` files.
* Rotate secrets if exposed.
* Plaid access tokens are encrypted before storage.
