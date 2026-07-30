import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";
import Goal from "../models/Goal";
import GoalContribution from "../models/GoalContribution";
import { computeGoalProgress } from "../utils/cashFlow";
import { effectiveCategory } from "../services/categorization";

const router = Router();

async function goalDto(goal: InstanceType<typeof Goal>, userId: typeof goal.userId) {
  const [txns, contributions] = await Promise.all([
    Transaction.find({ userId, excludedFromTotals: { $ne: true } }).select(
      "amount date userCategory suggestedCategory category isCreditCardPayment"
    ),
    GoalContribution.find({ goalId: goal._id, userId }),
  ]);

  const mapped = txns.map((t) => ({
    amount: t.amount,
    date: t.date,
    category: effectiveCategory(t),
    isCreditCardPayment: t.isCreditCardPayment,
  }));

  const fromCashFlow = computeGoalProgress(mapped, goal.createdAt, goal.deadline);
  const fromContributions = contributions.reduce((s, c) => s + c.amount, 0);
  const saved = Math.round((fromCashFlow + fromContributions) * 100) / 100;
  const target = goal.targetAmount;
  const progressPercent = target > 0 ? Math.min(Math.round((saved / target) * 1000) / 10, 100) : 0;

  return {
    _id: goal._id.toString(),
    title: goal.title,
    targetAmount: goal.targetAmount,
    deadline: goal.deadline.toISOString(),
    createdAt: goal.createdAt.toISOString(),
    saved,
    fromCashFlow,
    fromContributions,
    progressPercent,
    completed: saved >= target,
    contributions: contributions
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((c) => ({
        _id: c._id.toString(),
        amount: c.amount,
        date: c.date.toISOString(),
        note: c.note,
      })),
  };
}

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json([]);

    const goals = await Goal.find({ userId: user._id }).sort({ deadline: 1 });
    const result = await Promise.all(goals.map((g) => goalDto(g, user._id)));
    res.json(result);
  } catch (error) {
    console.error("goals GET failed", error);
    res.status(500).json({ error: "Failed to load goals" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { title, targetAmount, deadline } = req.body as {
      title?: string;
      targetAmount?: number;
      deadline?: string;
    };

    if (!title?.trim() || typeof targetAmount !== "number" || targetAmount < 1 || !deadline) {
      return res.status(400).json({ error: "title, targetAmount, and deadline are required" });
    }

    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      return res.status(400).json({ error: "deadline must be a future date" });
    }

    const goal = await Goal.create({
      userId: user._id,
      title: title.trim(),
      targetAmount,
      deadline: deadlineDate,
    });

    res.status(201).json(await goalDto(goal, user._id));
  } catch (error) {
    console.error("goals POST failed", error);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

router.post("/:id/contributions", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const goal = await Goal.findOne({ _id: req.params.id, userId: user._id });
    if (!goal) return res.status(404).json({ error: "Goal not found" });

    const { amount, date, note } = req.body as { amount?: number; date?: string; note?: string };
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount > 0 required" });
    }

    await GoalContribution.create({
      userId: user._id,
      goalId: goal._id,
      amount,
      date: date ? new Date(date) : new Date(),
      note: note?.trim(),
    });

    res.status(201).json(await goalDto(goal, user._id));
  } catch (error) {
    console.error("contribution failed", error);
    res.status(500).json({ error: "Failed to add contribution" });
  }
});

router.delete("/:id/contributions/:cid", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const result = await GoalContribution.deleteOne({
      _id: req.params.cid,
      goalId: req.params.id,
      userId: user._id,
    });
    if (!result.deletedCount) return res.status(404).json({ error: "Contribution not found" });

    const goal = await Goal.findOne({ _id: req.params.id, userId: user._id });
    if (!goal) return res.json({ success: true });
    res.json(await goalDto(goal, user._id));
  } catch (error) {
    console.error("contribution delete failed", error);
    res.status(500).json({ error: "Failed to delete contribution" });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { title, targetAmount, deadline } = req.body as {
      title?: string;
      targetAmount?: number;
      deadline?: string;
    };

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (typeof targetAmount === "number") updates.targetAmount = targetAmount;
    if (deadline !== undefined) {
      const deadlineDate = new Date(deadline);
      if (Number.isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ error: "Invalid deadline" });
      }
      updates.deadline = deadlineDate;
    }

    const goal = await Goal.findOneAndUpdate({ _id: req.params.id, userId: user._id }, updates, { new: true });
    if (!goal) return res.status(404).json({ error: "Goal not found" });

    res.json(await goalDto(goal, user._id));
  } catch (error) {
    console.error("goals PUT failed", error);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const result = await Goal.deleteOne({ _id: req.params.id, userId: user._id });
    if (!result.deletedCount) return res.status(404).json({ error: "Goal not found" });
    await GoalContribution.deleteMany({ goalId: req.params.id, userId: user._id });
    res.json({ success: true });
  } catch (error) {
    console.error("goals DELETE failed", error);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

export default router;
