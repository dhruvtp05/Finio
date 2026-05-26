import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";

const router = Router();

router.get("/", auth, async (req, res) => {
  const { month, category } = req.query;
  const limit = Math.min(Number(req.query.limit || 25), 100);
  const page = Math.max(Number(req.query.page || 1), 1);

  const user = await (User as any).findOne({ email: req.user!.email });
  if (!user) return res.json({ transactions: [], total: 0, page, limit });

  const query: any = { userId: user._id };

  if (typeof month === "string" && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    query.date = {
      $gte: new Date(y, m - 1, 1),
      $lt: new Date(y, m, 1),
    };
  }

  if (typeof category === "string" && category.length) {
    query.category = { $regex: category, $options: "i" };
  }

  const [transactions, total] = await Promise.all([
    (Transaction as any)
      .find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    (Transaction as any).countDocuments(query),
  ]);

  return res.json({ transactions, total, page, limit });
});

router.get("/summary", auth, async (req, res) => {
  const user = await (User as any).findOne({ email: req.user!.email });
  if (!user) {
    return res.json({ totalSpent: 0, totalIncome: 0, byCategory: [], byMonth: [] });
  }

  const txns = await (Transaction as any).find({ userId: user._id });

  const totalSpent = txns.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = txns.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const categoryMap = new Map<string, number>();
  const monthMap = new Map<string, { month: string; spent: number; income: number }>();

  txns.forEach((txn) => {
    const category = txn.category?.[0] || "Uncategorized";
    if (txn.amount > 0) {
      categoryMap.set(category, (categoryMap.get(category) || 0) + txn.amount);
    }

    const date = new Date(txn.date);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = monthMap.get(month) || { month, spent: 0, income: 0 };

    if (txn.amount > 0) current.spent += txn.amount;
    else current.income += Math.abs(txn.amount);

    monthMap.set(month, current);
  });

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const byMonth = Array.from(monthMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(({ month, spent }) => ({ month, spent }));

  return res.json({ totalSpent, totalIncome, byCategory, byMonth });
});

export default router;
