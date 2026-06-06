import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";
import { FINIO_CATEGORIES } from "../constants/categories";
import { normalizeToFinioCategory } from "../services/categorization";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ categories: FINIO_CATEGORIES });
});

router.post("/recategorize-all", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const txns = await Transaction.find({ userId: user._id });
    let updated = 0;

    for (const txn of txns) {
      const normalized = normalizeToFinioCategory(txn.merchantName, txn.name, txn.category);
      if (txn.suggestedCategory !== normalized) {
        txn.suggestedCategory = normalized;
        await txn.save();
        updated += 1;
      }
    }

    res.json({ updated, total: txns.length });
  } catch (error) {
    console.error("recategorize-all failed", error);
    res.status(500).json({ error: "Failed to recategorize transactions" });
  }
});

export default router;
