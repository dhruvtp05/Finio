import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";
import Goal from "../models/Goal";
import { computeGoalProgress } from "../utils/cashFlow";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json([]);

    const goals = await Goal.find({ userId: user._id }).sort({ deadline: 1 });
    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).select("amount date");

    const result = goals.map((goal) => {
      const saved = computeGoalProgress(txns, goal.createdAt, goal.deadline);
      const target = goal.targetAmount;
      const progressPercent = target > 0 ? Math.min(Math.round((saved / target) * 1000) / 10, 100) : 0;

      return {
        _id: goal._id.toString(),
        title: goal.title,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline.toISOString(),
        createdAt: goal.createdAt.toISOString(),
        saved,
        progressPercent,
        completed: saved >= target,
      };
    });

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

    res.status(201).json({
      _id: goal._id.toString(),
      title: goal.title,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline.toISOString(),
      createdAt: goal.createdAt.toISOString(),
      saved: 0,
      progressPercent: 0,
      completed: false,
    });
  } catch (error) {
    console.error("goals POST failed", error);
    res.status(500).json({ error: "Failed to create goal" });
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

    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).select("amount date");
    const saved = computeGoalProgress(txns, goal.createdAt, goal.deadline);

    res.json({
      _id: goal._id.toString(),
      title: goal.title,
      targetAmount: goal.targetAmount,
      deadline: goal.deadline.toISOString(),
      createdAt: goal.createdAt.toISOString(),
      saved,
      progressPercent: goal.targetAmount > 0 ? Math.min((saved / goal.targetAmount) * 100, 100) : 0,
      completed: saved >= goal.targetAmount,
    });
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
    res.json({ success: true });
  } catch (error) {
    console.error("goals DELETE failed", error);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});

export default router;
