import { Router } from "express";
import auth from "../middleware/auth";
import User, { IUserDocument } from "../models/User";
import Transaction from "../models/Transaction";
import Budget, { DEFAULT_BUDGETS } from "../models/Budget";
import { effectiveCategory, isFinioCategory } from "../services/categorization";

const router = Router();

function getMonthRange(offsetMonths = 0, date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth() + offsetMonths, 1);
  const end = new Date(date.getFullYear(), date.getMonth() + offsetMonths + 1, 1);
  return { start, end };
}

function spentMapForRange(
  txns: Array<{
    amount: number;
    date: Date;
    excludedFromTotals?: boolean;
    userCategory?: string;
    suggestedCategory?: string;
    category?: string[];
    isCreditCardPayment?: boolean;
  }>,
  start: Date,
  end: Date
) {
  const map = new Map<string, number>();
  txns.forEach((txn) => {
    if (txn.excludedFromTotals || txn.amount <= 0 || txn.isCreditCardPayment) return;
    const d = new Date(txn.date);
    if (d < start || d >= end) return;
    const cat = effectiveCategory(txn as Parameters<typeof effectiveCategory>[0]);
    if (cat === "Transfers" || cat === "Income") return;
    map.set(cat, (map.get(cat) || 0) + txn.amount);
  });
  return map;
}

async function ensureDefaultBudgets(userId: IUserDocument["_id"]) {
  const count = await Budget.countDocuments({ userId });
  if (count > 0) return;
  await Budget.insertMany(DEFAULT_BUDGETS.map((b) => ({ ...b, userId, rolloverEnabled: true })));
}

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json([]);

    await ensureDefaultBudgets(user._id);

    const budgets = await Budget.find({ userId: user._id }).sort({ label: 1 });
    const { start, end } = getMonthRange(0);
    const prev = getMonthRange(-1);

    const txns = await Transaction.find({
      userId: user._id,
      date: { $gte: prev.start, $lt: end },
      excludedFromTotals: { $ne: true },
    });

    const thisMonth = spentMapForRange(txns, start, end);
    const lastMonth = spentMapForRange(txns, prev.start, prev.end);

    const result = budgets.map((budget) => {
      const spent = thisMonth.get(budget.category) || 0;
      const lastSpent = lastMonth.get(budget.category) || 0;
      const rolloverEnabled = budget.rolloverEnabled !== false;
      const rolloverAmount = rolloverEnabled ? Math.max(0, Math.round((budget.limit - lastSpent) * 100) / 100) : 0;
      const effectiveLimit = Math.round((budget.limit + rolloverAmount) * 100) / 100;

      return {
        _id: budget._id.toString(),
        category: budget.category,
        label: budget.label,
        limit: budget.limit,
        spent,
        rolloverEnabled,
        rolloverAmount,
        effectiveLimit,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("budgets GET failed", error);
    res.status(500).json({ error: "Failed to load budgets" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { category, label, limit, rolloverEnabled } = req.body as {
      category?: string;
      label?: string;
      limit?: number;
      rolloverEnabled?: boolean;
    };
    if (!category?.trim() || !label?.trim() || typeof limit !== "number" || limit < 0) {
      return res.status(400).json({ error: "category, label, and limit are required" });
    }
    if (!isFinioCategory(category.trim())) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const budget = await Budget.create({
      userId: user._id,
      category: category.trim(),
      label: label.trim(),
      limit,
      rolloverEnabled: rolloverEnabled !== false,
    });
    res.status(201).json({
      _id: budget._id.toString(),
      category: budget.category,
      label: budget.label,
      limit: budget.limit,
      spent: 0,
      rolloverEnabled: budget.rolloverEnabled !== false,
      rolloverAmount: 0,
      effectiveLimit: budget.limit,
    });
  } catch (error) {
    console.error("budgets POST failed", error);
    res.status(500).json({ error: "Failed to create budget" });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { label, limit, category, rolloverEnabled } = req.body as {
      label?: string;
      limit?: number;
      category?: string;
      rolloverEnabled?: boolean;
    };
    if (category !== undefined && !isFinioCategory(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      {
        ...(label !== undefined ? { label } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(typeof limit === "number" ? { limit } : {}),
        ...(typeof rolloverEnabled === "boolean" ? { rolloverEnabled } : {}),
      },
      { new: true }
    );

    if (!budget) return res.status(404).json({ error: "Budget not found" });
    res.json({
      _id: budget._id.toString(),
      category: budget.category,
      label: budget.label,
      limit: budget.limit,
      spent: 0,
      rolloverEnabled: budget.rolloverEnabled !== false,
      rolloverAmount: 0,
      effectiveLimit: budget.limit,
    });
  } catch (error) {
    console.error("budgets PUT failed", error);
    res.status(500).json({ error: "Failed to update budget" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const result = await Budget.deleteOne({ _id: req.params.id, userId: user._id });
    if (!result.deletedCount) return res.status(404).json({ error: "Budget not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("budgets DELETE failed", error);
    res.status(500).json({ error: "Failed to delete budget" });
  }
});

export default router;
