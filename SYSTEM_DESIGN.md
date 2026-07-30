# Finio — System Design

This document describes how Finio is structured: components, data flow, and the logic behind key features. Use it as a reference when extending the app or onboarding to the codebase.

---

## Overview

Finio is a personal finance dashboard that connects to banks via **Plaid** (sandbox in development), syncs transactions into **MongoDB**, and presents analytics, budgets, recurring-charge detection, cash-flow metrics, and savings goals in a **Next.js** frontend talking to an **Express** API.

```
┌─────────────┐     JWT (NextAuth)      ┌──────────────┐
│  Next.js    │ ◄──────────────────────►│  Express API │
│  (client)   │     REST /api/*         │  (server)    │
└──────┬──────┘                         └──────┬───────┘
       │                                       │
       │ Google OAuth                          │ Mongoose
       ▼                                       ▼
┌─────────────┐                         ┌──────────────┐
│  NextAuth   │                         │   MongoDB    │
└─────────────┘                         └──────────────┘
                                               ▲
                                               │ Plaid SDK
                                        ┌──────┴───────┐
                                        │ Plaid (bank) │
                                        └──────────────┘
```

---

## Repository layout

| Path | Role |
|------|------|
| `Finio/client/` | Next.js App Router UI, NextAuth, API client |
| `Finio/server/` | Express API, Mongoose models, Plaid sync |
| `Finio/shared/` | Shared TypeScript types (`types.ts`, `categories.ts`) |

The root `package.json` is an npm workspace orchestrator (`dev:client`, `dev:server`).

---

## Authentication

1. User signs in with **Google** via NextAuth on the client.
2. The client sends `Authorization: Bearer <JWT>` on API calls (`lib/api.ts`), signed with `NEXTAUTH_SECRET` (must match server).
3. Server middleware (`middleware/auth.ts`) verifies the JWT and attaches `req.user.email`.
4. All protected routes resolve the `User` document by email.

Plaid access tokens are stored **encrypted** (AES-256-GCM) on the user record, never returned to the client.

---

## Data model

### User

- Profile: email, name, image
- Plaid: encrypted access token, item id, sync cursor
- Created on first OAuth sync (`POST /api/users/sync-profile`)

### Transaction

Synced from Plaid (`plaidSync.ts`):

- `amount`: Plaid convention — **positive = expense**, **negative = income**
- `merchantName`, `name`, `date`, `category[]`, `pending`
- Categorization: `suggestedCategory` (rules/keywords), overridable `userCategory`

Indexes: `{ userId, date }`, unique sparse `plaidTransactionId`.

### Budget

Per-user category caps: `category`, `label`, `limit`. Default budgets seeded on first `GET /api/budgets`. **Spent** is computed at read time from current-month transactions.

### Goal

User-defined savings target: `title`, `targetAmount`, `deadline`. Progress is **not** stored; it is derived from transactions (see below).

---

## Plaid sync pipeline

1. **Link**: `create-link-token` → user completes Plaid Link → `exchange-token` stores encrypted token and runs initial sync.
2. **Incremental sync**: `transactionsSync` with cursor; upserts added/modified, deletes removed.
3. **Fallback**: If no cursor, `transactionsGet` for last 30 days.
4. **Webhooks**: `POST /api/plaid/webhook` triggers re-sync by item id.

Transactions are upserted by `plaidTransactionId` via `bulkWrite`.

---

## Categorization

`services/categorization.ts` maps Plaid categories and merchant keywords to Finio’s fixed category list (`shared/categories.ts`). `effectiveCategory(txn)` returns `userCategory` → `suggestedCategory` → first Plaid category → `"Other"`.

---

## Feature: Cash flow & net position

**Endpoint:** `GET /api/transactions/cashflow`

**Logic** (`server/src/utils/cashFlow.ts`):

| Metric | Definition |
|--------|------------|
| Money in (month) | Sum of `\|amount\|` where `amount < 0` in current calendar month |
| Money out (month) | Sum of `amount` where `amount > 0` in current month |
| Net this month | Income − spending |
| Savings rate % | `(net / income) × 100` when income > 0 |
| Avg daily spend | Money out ÷ day-of-month (1-based) |
| Net position | Lifetime income − lifetime spending (proxy for cumulative savings) |

No new external APIs — pure aggregation over stored transactions.

---

## Feature: Recurring / subscriptions

**Endpoint:** `GET /api/transactions/recurring`

**Logic** (`server/src/utils/recurring.ts`):

1. Group expense transactions by normalized merchant name (lowercase, trimmed).
2. Require ≥2 charges, similar amounts (within 20% of median or $3), activity in ≥2 calendar months.
3. Infer cadence from median gap between charges:
   - **Monthly:** 25–38 days (with fallback 20–45 when months ≥2)
   - **Weekly:** 6–9 days
4. Exclude pending charges.

Output: merchant display name, category, average amount, cadence, occurrence count, last date.

This is heuristic, not ML — good for demos and “we understand your data” narratives without subscription APIs.

---

## Feature: Savings goals

**Endpoints:** `GET/POST/PUT/DELETE /api/goals`

**Progress calculation:**

From `goal.createdAt` until `min(now, deadline)`:

```
saved = Σ(income) − Σ(spending)
```

Where income = negative Plaid amounts, spending = positive amounts in that date range.

`progressPercent = min(saved / targetAmount × 100, 100)`.

Progress updates automatically whenever transactions sync — no manual logging.

---

## Feature: Budgets

Same pattern as goals for **spent**: computed at request time from current-month transactions per budget category. UI shows progress bars with warn colors at 80% / 100%.

---

## Feature: Spending timeline (charts)

**Endpoint:** `GET /api/transactions/spending-timeline?groupBy=day|week|month|year&limit=N`

Buckets transactions by period key (`utils/spendingTimeline.ts`), returns `{ label, spent, income }[]` for Recharts on the dashboard.

---

## Frontend architecture

- **App Router** pages: `/` (landing), `/dashboard`, `/transactions`, `/settings`
- **DashboardClient**: parallel fetch of summary, cashflow, recurring, budgets, goals, recent txns
- **Theme**: `ThemeContext` + `class="dark"` on `<html>`, persisted in `localStorage` (`finio-theme`)
- **Styling**: Tailwind + `.finio-card`, `.finio-btn-*`, `.finio-input` in `globals.css`

---

## API surface (summary)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/transactions` | Paginated, filterable list |
| GET | `/api/transactions/summary` | Totals, by category, by month |
| GET | `/api/transactions/cashflow` | Monthly cash flow metrics |
| GET | `/api/transactions/recurring` | Detected subscriptions |
| GET | `/api/transactions/spending-timeline` | Chart series |
| GET | `/api/budgets` | Budgets + spent |
| GET/POST/PUT/DELETE | `/api/goals` | Savings goals |
| POST | `/api/plaid/*` | Link, exchange, sync, webhook |

---

## Security

- Helmet, CORS restricted to `CLIENT_URL`, rate limiting on `/api/`
- JWT auth on all user data routes
- Plaid tokens encrypted at rest
- `.env` secrets never committed

---

## Deployment notes

- **Client:** Vercel — env vars for NextAuth, `NEXT_PUBLIC_API_URL`
- **Server:** Render/Railway — MongoDB URI, Plaid keys, matching `NEXTAUTH_SECRET`, CORS origin
- Plaid webhooks need a public HTTPS URL pointing at `/api/plaid/webhook`

---

## Extension ideas

Many earlier ideas are now implemented (net worth from balances, annual recurring, goal contributions, budget/goal alerts, insights, rules, runway, receipts). Remaining stretch ideas:

- Plaid Link update mode (re-auth without full disconnect)
- Account / data deletion for the signed-in user
- Scheduled digest cron (currently on-demand from Settings)
- Household / shared budgets
- Plaid Investments product
