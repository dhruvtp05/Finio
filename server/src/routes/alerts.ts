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
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const [budgets, goals, rangeTxns, allTxns] = await Promise.all([
      Budget.find({ userId: user._id }),
      Goal.find({ userId: user._id }),
      Transaction.find({
        userId: user._id,
        date: { $gte: prevStart, $lt: end },
        excludedFromTotals: { $ne: true },
      }),
      Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).select(
        "amount date userCategory suggestedCategory category isCreditCardPayment"
      ),
    ]);

    const spentThis = new Map<string, number>();
    const spentPrev = new Map<string, number>();
    rangeTxns.forEach((txn) => {
      if (txn.amount <= 0 || txn.isCreditCardPayment) return;
      const cat = effectiveCategory(txn);
      if (cat === "Transfers" || cat === "Income") return;
      const d = new Date(txn.date);
      if (d >= start && d < end) spentThis.set(cat, (spentThis.get(cat) || 0) + txn.amount);
      else if (d >= prevStart && d < start) spentPrev.set(cat, (spentPrev.get(cat) || 0) + txn.amount);
    });

    const budgetInputs = budgets.map((b) => {
      const spent = spentThis.get(b.category) || 0;
      const lastSpent = spentPrev.get(b.category) || 0;
      const rollover = b.rolloverEnabled !== false ? Math.max(0, b.limit - lastSpent) : 0;
      return {
        _id: b._id.toString(),
        label: b.label,
        category: b.category,
        limit: b.limit + rollover,
        spent,
      };
    });

    const mappedTxns = allTxns.map((t) => ({
      amount: t.amount,
      date: t.date,
      category: effectiveCategory(t),
      isCreditCardPayment: t.isCreditCardPayment,
    }));

    const goalInputs = goals.map((g) => {
      const saved = computeGoalProgress(mappedTxns, g.createdAt, g.deadline);
      return {
        _id: g._id.toString(),
        title: g.title,
        targetAmount: g.targetAmount,
        deadline: g.deadline,
        saved,
        completed: saved >= g.targetAmount,
        createdAt: g.createdAt,
      };
    });

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
