import { Router } from "express";
import auth from "../middleware/auth";
import User, { IUserDocument } from "../models/User";
import Transaction from "../models/Transaction";
import Budget, { DEFAULT_BUDGETS } from "../models/Budget";
import { effectiveCategory, isFinioCategory } from "../services/categorization";

const router = Router();

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

async function ensureDefaultBudgets(userId: IUserDocument["_id"]) {
  const count = await Budget.countDocuments({ userId });
  if (count > 0) return;
  await Budget.insertMany(DEFAULT_BUDGETS.map((b) => ({ ...b, userId })));
}

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json([]);

    await ensureDefaultBudgets(user._id);

    const budgets = await Budget.find({ userId: user._id }).sort({ label: 1 });
    const { start, end } = getMonthRange();
    const txns = await Transaction.find({
      userId: user._id,
      date: { $gte: start, $lt: end },
      excludedFromTotals: { $ne: true },
    });

    const spentByCategory = new Map<string, number>();
    txns.forEach((txn) => {
      if (txn.amount <= 0) return;
      const cat = effectiveCategory(txn);
      spentByCategory.set(cat, (spentByCategory.get(cat) || 0) + txn.amount);
    });

    const result = budgets.map((budget) => ({
      _id: budget._id.toString(),
      category: budget.category,
      label: budget.label,
      limit: budget.limit,
      spent: spentByCategory.get(budget.category) || 0,
    }));

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

    const { category, label, limit } = req.body as { category?: string; label?: string; limit?: number };
    if (!category?.trim() || !label?.trim() || typeof limit !== "number" || limit < 0) {
      return res.status(400).json({ error: "category, label, and limit are required" });
    }
    if (!isFinioCategory(category.trim())) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const budget = await Budget.create({ userId: user._id, category: category.trim(), label: label.trim(), limit });
    res.status(201).json({
      _id: budget._id.toString(),
      category: budget.category,
      label: budget.label,
      limit: budget.limit,
      spent: 0,
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

    const { label, limit, category } = req.body as { label?: string; limit?: number; category?: string };
    if (category !== undefined && !isFinioCategory(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      {
        ...(label !== undefined ? { label } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(typeof limit === "number" ? { limit } : {}),
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
