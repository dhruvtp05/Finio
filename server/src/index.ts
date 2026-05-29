import "./loadEnv";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import mongoose from "mongoose";
import plaidRoutes from "./routes/plaid";
import transactionRoutes from "./routes/transactions";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/plaid", plaidRoutes);
app.use("/api/transactions", transactionRoutes);

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
