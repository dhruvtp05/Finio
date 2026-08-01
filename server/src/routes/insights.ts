import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";
import Budget, { DEFAULT_BUDGETS } from "../models/Budget";
import Account from "../models/Account";
import { effectiveCategory } from "../services/categorization";
import { buildMerchantInsights, buildWeeklyDigest } from "../utils/insights";
import { detectRecurringSubscriptions } from "../utils/recurring";
import { buildBillCalendar, buildHeatmap, computeRunway } from "../utils/planning";
import { accountContribution } from "../utils/netWorth";
import { sendWeeklyDigestEmail, smtpConfigured } from "../utils/email";

const router = Router();

function monthRange(offsetMonths = 0, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  return { start, end };
}

function spentByCategory(
  txns: Array<{
    amount: number;
    date: Date;
    userCategory?: string;
    suggestedCategory?: string;
    category?: string[];
    excludedFromTotals?: boolean;
    isCreditCardPayment?: boolean;
  }>,
  start: Date,
  end: Date
) {
  const map = new Map<string, number>();
  txns.forEach((txn) => {
    if (txn.excludedFromTotals || txn.amount <= 0 || txn.isCreditCardPayment) return;
    const date = new Date(txn.date);
    if (date < start || date >= end) return;
    const cat = effectiveCategory(txn as Parameters<typeof effectiveCategory>[0]);
    if (cat === "Transfers" || cat === "Income") return;
    map.set(cat, (map.get(cat) || 0) + txn.amount);
  });
  return map;
}

async function digestForUser(email: string) {
  const user = await User.findOne({ email });
  if (!user) return { user: null, digest: buildWeeklyDigest([], []) };

  const budgetCount = await Budget.countDocuments({ userId: user._id });
  if (budgetCount === 0) {
    await Budget.insertMany(DEFAULT_BUDGETS.map((b) => ({ ...b, userId: user._id })));
  }

  const { start, end } = monthRange(0);
  const [txns, budgets] = await Promise.all([
    Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }),
    Budget.find({ userId: user._id }),
  ]);

  const spentMap = spentByCategory(txns, start, end);
  const budgetInputs = budgets.map((b) => ({
    label: b.label,
    limit: b.limit,
    spent: spentMap.get(b.category) || 0,
  }));

  return { user, digest: buildWeeklyDigest(txns, budgetInputs) };
}

router.get("/weekly", auth, async (req, res) => {
  try {
    const { digest } = await digestForUser(req.user!.email);
    res.json(digest);
  } catch (error) {
    console.error("insights weekly failed", error);
    res.status(500).json({ error: "Failed to build weekly digest" });
  }
});

router.post("/weekly/email", auth, async (req, res) => {
  try {
    const { digest, user } = await digestForUser(req.user!.email);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!smtpConfigured()) {
      return res.status(400).json({
        error: "SMTP not configured",
        hint: "Set SMTP_HOST, SMTP_USER, SMTP_PASS on the server to enable email digests.",
        preview: digest,
      });
    }

    await sendWeeklyDigestEmail(user.email, digest);
    user.digestEmailEnabled = true;
    await user.save();
    res.json({ sent: true, to: user.email });
  } catch (error) {
    console.error("digest email failed", error);
    res.status(500).json({ error: (error as Error).message || "Failed to send digest" });
  }
});

router.get("/merchants", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json({ merchants: [], year: null });

    const yearParam = typeof req.query.year === "string" ? Number(req.query.year) : undefined;
    const year = yearParam && Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = Math.min(Number(req.query.limit || 25), 50);

    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } });
    const merchants = buildMerchantInsights(txns, { year, search, limit });

    res.json({ year, merchants });
  } catch (error) {
    console.error("insights merchants failed", error);
    res.status(500).json({ error: "Failed to load merchant insights" });
  }
});

router.get("/bills", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json({ bills: [] });
    const days = Math.min(Math.max(Number(req.query.days || 45), 7), 90);
    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } });
    const subs = detectRecurringSubscriptions(txns, effectiveCategory);
    res.json({ bills: buildBillCalendar(subs, days), days });
  } catch (error) {
    console.error("bills failed", error);
    res.status(500).json({ error: "Failed to build bill calendar" });
  }
});

router.get("/runway", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) {
      return res.json(computeRunway({ liquidAssets: 0, txns: [], subscriptions: [] }));
    }

    const cancelledParam = typeof req.query.cancelled === "string" ? req.query.cancelled : "";
    const cancelledKeys = cancelledParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const [txns, accounts] = await Promise.all([
      Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } }),
      Account.find({ userId: user._id }),
    ]);

    const liquidAssets = accounts
      .filter((a) => a.type === "depository" || a.type === "investment")
      .reduce((s, a) => s + accountContribution(a.type, a.currentBalance).assets, 0);

    const mapped = txns.map((t) => ({
      amount: t.amount,
      date: t.date,
      category: effectiveCategory(t),
      isCreditCardPayment: t.isCreditCardPayment,
      excludedFromTotals: t.excludedFromTotals,
    }));

    const subs = detectRecurringSubscriptions(txns, effectiveCategory);
    res.json(
      computeRunway({
        liquidAssets,
        txns: mapped,
        subscriptions: subs,
        cancelledKeys,
      })
    );
  } catch (error) {
    console.error("runway failed", error);
    res.status(500).json({ error: "Failed to compute runway" });
  }
});

router.get("/heatmap", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json(buildHeatmap([]));
    const daysBack = Math.min(Math.max(Number(req.query.days || 90), 30), 365);
    const txns = await Transaction.find({ userId: user._id, excludedFromTotals: { $ne: true } });
    const mapped = txns.map((t) => ({
      amount: t.amount,
      date: t.date,
      merchantName: t.merchantName,
      name: t.name,
      category: effectiveCategory(t),
      isCreditCardPayment: t.isCreditCardPayment,
      excludedFromTotals: t.excludedFromTotals,
    }));
    res.json(buildHeatmap(mapped, daysBack));
  } catch (error) {
    console.error("heatmap failed", error);
    res.status(500).json({ error: "Failed to build heatmap" });
  }
});

export default router;
