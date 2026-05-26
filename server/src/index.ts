import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import plaidRoutes from "./routes/plaid";
import transactionRoutes from "./routes/transactions";

dotenv.config();

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

const port = Number(process.env.PORT || 5000);

async function start() {
  try {
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
