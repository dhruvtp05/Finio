import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";
import Budget, { DEFAULT_BUDGETS } from "../models/Budget";
import Goal from "../models/Goal";
import { effectiveCategory } from "../services/categorization";
import { computeAlerts } from "../utils/alerts";
import { computeGoalProgress } from "../utils/cashFlow";

const router = Router();

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json({ alerts: [] });

    const budgetCount = await Budget.countDocuments({ userId: user._id });
    if (budgetCount === 0) {
      await Budget.insertMany(DEFAULT_BUDGETS.map((b) => ({ ...b, userId: user._id })));
    }

    const { start, end } = getMonthRange();
    const [budgets, goals, monthTxns, allTxns] = await Promise.all([
      Budget.find({ userId: user._id }),
      Goal.find({ userId: user._id }),
      Transaction.find({ userId: user._id, date: { $gte: start, $lt: end }, excludedFromTotals: { $ne: true } }),
      Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).select("amount date"),
    ]);

    const spentByCategory = new Map<string, number>();
    monthTxns.forEach((txn) => {
      if (txn.amount <= 0) return;
      const cat = effectiveCategory(txn);
      spentByCategory.set(cat, (spentByCategory.get(cat) || 0) + txn.amount);
    });

    const budgetInputs = budgets.map((b) => ({
      _id: b._id.toString(),
      label: b.label,
      category: b.category,
      limit: b.limit,
      spent: spentByCategory.get(b.category) || 0,
    }));

    const goalInputs = goals.map((g) => ({
      _id: g._id.toString(),
      title: g.title,
      targetAmount: g.targetAmount,
      deadline: g.deadline,
      saved: computeGoalProgress(allTxns, g.createdAt, g.deadline),
      completed: computeGoalProgress(allTxns, g.createdAt, g.deadline) >= g.targetAmount,
      createdAt: g.createdAt,
    }));

    const alerts = computeAlerts(budgetInputs, goalInputs, user.dismissedAlertKeys || []);
    res.json({ alerts });
  } catch (error) {
    console.error("alerts GET failed", error);
    res.status(500).json({ error: "Failed to load alerts" });
  }
});

router.post("/dismiss", auth, async (req, res) => {
  try {
    const { key } = req.body as { key?: string };
    if (!key?.trim()) return res.status(400).json({ error: "key is required" });

    const user = await User.findOneAndUpdate(
      { email: req.user!.email },
      { $addToSet: { dismissedAlertKeys: key.trim() } },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("alerts dismiss failed", error);
    res.status(500).json({ error: "Failed to dismiss alert" });
  }
});

export default router;
