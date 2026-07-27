import { Router } from "express";
import { Types } from "mongoose";
import auth from "../middleware/auth";
import User from "../models/User";
import Account from "../models/Account";
import Transaction, { ITransactionDocument } from "../models/Transaction";
import { effectiveCategory, isFinioCategory } from "../services/categorization";
import { buildSpendingTimeline, isValidGroupBy } from "../utils/spendingTimeline";
import { detectRecurringSubscriptions } from "../utils/recurring";
import { computeCashFlowMetrics } from "../utils/cashFlow";
import { computeMonthCompare } from "../utils/monthCompare";
import { computeNetWorthFromAccounts } from "../utils/netWorth";

const router = Router();

function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildQuery(userId: Types.ObjectId, params: { month?: string; category?: string; search?: string }) {
  const query: Record<string, unknown> = { userId, excludedFromTotals: { $ne: true } };

  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    query.date = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
  }

  if (params.category) {
    query.$or = [
      { category: { $regex: params.category, $options: "i" } },
      { userCategory: { $regex: params.category, $options: "i" } },
      { suggestedCategory: { $regex: params.category, $options: "i" } },
    ];
  }

  if (params.search) {
    query.$and = [
      ...(Array.isArray(query.$and) ? query.$and : []),
      {
        $or: [
          { merchantName: { $regex: params.search, $options: "i" } },
          { name: { $regex: params.search, $options: "i" } },
        ],
      },
    ];
  }

  return query;
}

function toDto(txn: ITransactionDocument) {
  return {
    _id: txn._id.toString(),
    date: txn.date.toISOString(),
    name: txn.name,
    merchantName: txn.merchantName,
    category: txn.category,
    userCategory: txn.userCategory,
    suggestedCategory: txn.suggestedCategory,
    categoryLocked: Boolean(txn.categoryLocked),
    amount: txn.amount,
    pending: txn.pending,
    source: txn.source || "plaid",
    note: txn.note,
    excludedFromTotals: Boolean(txn.excludedFromTotals),
    splitFromId: txn.splitFromId?.toString(),
  };
}

router.get("/filters", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json({ months: [], categories: [] });

    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).select(
      "date category userCategory suggestedCategory"
    );
    const months = new Set<string>();
    const categories = new Set<string>();

    txns.forEach((txn) => {
      months.add(monthKey(new Date(txn.date)));
      categories.add(effectiveCategory(txn));
    });

    res.json({
      months: Array.from(months).sort().reverse(),
      categories: Array.from(categories).sort(),
    });
  } catch (error) {
    console.error("filters failed", error);
    res.status(500).json({ error: "Failed to load filters" });
  }
});

router.get("/export", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const txns = await Transaction.find(buildQuery(user._id, { month, category, search })).sort({ date: -1 });

    const header = "Date,Merchant,Category,Amount,Pending,Source,Locked\n";
    const rows = txns
      .map((txn) => {
        const date = new Date(txn.date).toISOString().slice(0, 10);
        const merchant = (txn.merchantName || txn.name || "").replace(/"/g, '""');
        const cat = effectiveCategory(txn).replace(/"/g, '""');
        return `${date},"${merchant}","${cat}",${txn.amount},${txn.pending ? "yes" : "no"},${txn.source || "plaid"},${txn.categoryLocked ? "yes" : "no"}`;
      })
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="finio-transactions.csv"');
    res.send(header + rows);
  } catch (error) {
    console.error("export failed", error);
    res.status(500).json({ error: "Failed to export transactions" });
  }
});

router.get("/compare", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) {
      return res.json(computeMonthCompare([]));
    }

    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } });
    const mapped = txns.map((t) => ({
      amount: t.amount,
      date: t.date,
      category: effectiveCategory(t),
      excludedFromTotals: t.excludedFromTotals,
    }));
    return res.json(computeMonthCompare(mapped));
  } catch (error) {
    console.error("compare failed", error);
    res.status(500).json({ error: "Failed to load month comparison" });
  }
});

router.get("/spending-timeline", auth, async (req, res) => {
  try {
    const groupByParam = typeof req.query.groupBy === "string" ? req.query.groupBy : "month";
    if (!isValidGroupBy(groupByParam)) {
      return res.status(400).json({ error: "groupBy must be day, week, month, or year" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit || 0), 0), 90) || undefined;

    const user = await User.findOne({ email: req.user!.email });
    if (!user) {
      return res.json({ groupBy: groupByParam, data: [] });
    }

    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).select("date amount");
    const data = buildSpendingTimeline(txns, groupByParam, limit);

    return res.json({ groupBy: groupByParam, data });
  } catch (error) {
    console.error("spending-timeline failed", error);
    res.status(500).json({ error: "Failed to load spending timeline" });
  }
});

router.get("/recurring", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json({ subscriptions: [] });

    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).sort({ date: -1 });
    const subscriptions = detectRecurringSubscriptions(txns, effectiveCategory);

    return res.json({ subscriptions });
  } catch (error) {
    console.error("recurring failed", error);
    res.status(500).json({ error: "Failed to detect recurring charges" });
  }
});

router.get("/cashflow", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) {
      return res.json({
        moneyInThisMonth: 0,
        moneyOutThisMonth: 0,
        netThisMonth: 0,
        savingsRatePercent: null,
        avgDailySpend: 0,
        netWorth: 0,
        daysElapsedInMonth: new Date().getDate(),
        netWorthSource: "transactions" as const,
      });
    }

    const [txns, accounts] = await Promise.all([
      Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }).select("amount date"),
      Account.find({ userId: user._id }),
    ]);

    const metrics = computeCashFlowMetrics(txns);
    if (accounts.length) {
      const fromBalances = computeNetWorthFromAccounts(accounts);
      metrics.netWorth = fromBalances.netWorth;
      return res.json({ ...metrics, netWorthSource: "accounts" as const, assets: fromBalances.assets, liabilities: fromBalances.liabilities });
    }

    return res.json({ ...metrics, netWorthSource: "transactions" as const });
  } catch (error) {
    console.error("cashflow failed", error);
    res.status(500).json({ error: "Failed to load cash flow" });
  }
});

router.get("/summary", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) {
      return res.json({
        totalSpent: 0,
        totalIncome: 0,
        totalSpentThisMonth: 0,
        totalIncomeThisMonth: 0,
        byCategory: [],
        byMonth: [],
      });
    }

    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } });
    const { start, end } = getMonthRange();

    let totalSpent = 0;
    let totalIncome = 0;
    let totalSpentThisMonth = 0;
    let totalIncomeThisMonth = 0;

    const categoryMap = new Map<string, number>();
    const monthMap = new Map<string, { month: string; spent: number; income: number }>();

    txns.forEach((txn) => {
      const category = effectiveCategory(txn);
      const date = new Date(txn.date);
      const month = monthKey(date);
      const inCurrentMonth = date >= start && date < end;

      if (txn.amount > 0) {
        totalSpent += txn.amount;
        if (inCurrentMonth) totalSpentThisMonth += txn.amount;
        categoryMap.set(category, (categoryMap.get(category) || 0) + txn.amount);
      } else {
        const income = Math.abs(txn.amount);
        totalIncome += income;
        if (inCurrentMonth) totalIncomeThisMonth += income;
      }

      const current = monthMap.get(month) || { month, spent: 0, income: 0 };
      if (txn.amount > 0) current.spent += txn.amount;
      else current.income += Math.abs(txn.amount);
      monthMap.set(month, current);
    });

    const byCategory = Array.from(categoryMap.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    const byMonth = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

    return res.json({
      totalSpent,
      totalIncome,
      totalSpentThisMonth,
      totalIncomeThisMonth,
      byCategory,
      byMonth,
    });
  } catch (error) {
    console.error("summary failed", error);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { name, merchantName, amount, date, category, note, type } = req.body as {
      name?: string;
      merchantName?: string;
      amount?: number;
      date?: string;
      category?: string;
      note?: string;
      /** expense (positive) or income (negative) */
      type?: "expense" | "income";
    };

    if (typeof amount !== "number" || amount <= 0 || !date) {
      return res.status(400).json({ error: "amount (>0) and date are required" });
    }
    if (category && !isFinioCategory(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const signed = type === "income" ? -Math.abs(amount) : Math.abs(amount);
    const txn = await Transaction.create({
      userId: user._id,
      name: name?.trim() || merchantName?.trim() || "Manual entry",
      merchantName: merchantName?.trim() || name?.trim() || "Manual",
      amount: signed,
      date: new Date(date),
      userCategory: category || (type === "income" ? "Income" : "Other"),
      suggestedCategory: category || (type === "income" ? "Income" : "Other"),
      categoryLocked: Boolean(category),
      source: "manual",
      note: note?.trim(),
      pending: false,
    });

    res.status(201).json(toDto(txn));
  } catch (error) {
    console.error("manual txn create failed", error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.patch("/:id/category", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { category, locked } = req.body as { category?: string; locked?: boolean };
    if (!category?.trim() || !isFinioCategory(category.trim())) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const txn = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: user._id, excludedFromTotals: { $ne: true } },
      {
        userCategory: category.trim(),
        categoryLocked: locked !== false,
      },
      { new: true }
    );

    if (!txn) return res.status(404).json({ error: "Transaction not found" });
    res.json(toDto(txn));
  } catch (error) {
    console.error("category patch failed", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.post("/:id/split", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const parent = await Transaction.findOne({
      _id: req.params.id,
      userId: user._id,
      excludedFromTotals: { $ne: true },
    });
    if (!parent) return res.status(404).json({ error: "Transaction not found" });

    const { parts } = req.body as {
      parts?: Array<{ amount: number; category: string; name?: string }>;
    };

    if (!Array.isArray(parts) || parts.length < 2) {
      return res.status(400).json({ error: "At least 2 parts required" });
    }

    const absParent = Math.abs(parent.amount);
    const sign = parent.amount >= 0 ? 1 : -1;
    let sum = 0;
    for (const p of parts) {
      if (typeof p.amount !== "number" || p.amount <= 0 || !isFinioCategory(p.category)) {
        return res.status(400).json({ error: "Each part needs amount > 0 and a valid category" });
      }
      sum += p.amount;
    }
    if (Math.abs(sum - absParent) > 0.02) {
      return res.status(400).json({ error: `Parts must sum to ${absParent.toFixed(2)}` });
    }

    parent.excludedFromTotals = true;
    await parent.save();

    const children = await Transaction.insertMany(
      parts.map((p) => ({
        userId: user._id,
        name: p.name?.trim() || parent.name,
        merchantName: parent.merchantName,
        amount: sign * p.amount,
        date: parent.date,
        userCategory: p.category,
        suggestedCategory: p.category,
        categoryLocked: true,
        source: parent.source === "manual" ? "manual" : "manual",
        note: `Split from ${parent.merchantName || parent.name || parent._id}`,
        splitFromId: parent._id,
        pending: false,
      }))
    );

    res.status(201).json({ parent: toDto(parent), parts: children.map(toDto) });
  } catch (error) {
    console.error("split failed", error);
    res.status(500).json({ error: "Failed to split transaction" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const txn = await Transaction.findOne({ _id: req.params.id, userId: user._id });
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    if (txn.source !== "manual" && !txn.splitFromId) {
      return res.status(400).json({ error: "Only manual (or split) transactions can be deleted" });
    }

    await Transaction.deleteOne({ _id: txn._id });
    res.json({ success: true });
  } catch (error) {
    console.error("txn delete failed", error);
    res.status(500).json({ error: "Failed to delete transaction" });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = Math.min(Number(req.query.limit || 25), 100);
    const page = Math.max(Number(req.query.page || 1), 1);

    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json({ transactions: [], total: 0, page, limit, totalPages: 0 });

    const query = buildQuery(user._id, { month, category, search });
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments(query),
    ]);

    return res.json({
      transactions: transactions.map(toDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (error) {
    console.error("transactions GET failed", error);
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

export default router;
