# Finio

Finio is a personal finance dashboard that combines Google OAuth authentication, Plaid sandbox transaction sync, and MongoDB-backed analytics into a clean Next.js UI.

## Tech Stack

- Frontend: Next.js 14 App Router, Tailwind CSS, Recharts, NextAuth
- Backend: Express.js + TypeScript
- Database: MongoDB + Mongoose
- Finance Integration: Plaid (sandbox)

## Local Setup

1. Install dependencies:
   - `cd finio`
   - `npm install`
2. Fill env files:
   - `client/.env.local`
   - `server/.env`
3. Start backend:
   - `npm run dev:server`
4. Start frontend in a second terminal:
   - `npm run dev:client`
5. Open `http://localhost:3000`.

## Plaid Sandbox Notes

- Use credentials from Plaid dashboard.
- During Plaid Link flow, use sandbox login `user_good` / `pass_good`.
- Plaid returns realistic mock transactions automatically.

## Future Improvements

- AI-based category suggestions
- Budget notifications and anomaly alerts
- CSV export and recurring report emails

## Screenshot

Add a screenshot after running the app locally and connecting a sandbox institution.
