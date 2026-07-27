import "./loadEnv";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import plaidRoutes from "./routes/plaid";
import transactionRoutes from "./routes/transactions";
import budgetRoutes from "./routes/budgets";
import userRoutes from "./routes/users";
import categoryRoutes from "./routes/categories";
import goalRoutes from "./routes/goals";
import alertRoutes from "./routes/alerts";
import accountRoutes from "./routes/accounts";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/plaid", authLimiter, plaidRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/accounts", accountRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled API error", err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT || 5000);

async function start() {
  try {
    if (!process.env.PLAID_CLIENT_ID?.trim() || !process.env.PLAID_SECRET?.trim()) {
      console.warn("Warning: PLAID_CLIENT_ID or PLAID_SECRET missing — Plaid Link will not work.");
    } else {
      console.log("Plaid env loaded (sandbox keys present).");
    }

    if (!process.env.TOKEN_ENCRYPTION_KEY && !process.env.NEXTAUTH_SECRET) {
      console.warn("Warning: set TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET for token encryption.");
    }

    await mongoose.connect(process.env.MONGODB_URI || "");
    app.listen(port, () => {
      console.log(`Server listening on ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

start();
