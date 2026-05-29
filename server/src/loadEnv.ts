import dotenv from "dotenv";
import path from "path";

// Load server/.env before any route modules read process.env (import order matters).
dotenv.config({ path: path.resolve(__dirname, "../.env") });
