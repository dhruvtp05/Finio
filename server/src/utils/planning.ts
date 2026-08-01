import { RecurringSubscription } from "./recurring";
import { applyMoney } from "./txnMoney";

export interface BillCalendarItem {
  merchantName: string;
  category: string;
  amount: number;
  dueDate: string;
  cadence: string;
  merchantKey: string;
}

export function buildBillCalendar(
  subscriptions: RecurringSubscription[],
  daysAhead = 45,
  now = new Date()
): BillCalendarItem[] {
  const end = new Date(now);
  end.setDate(end.getDate() + daysAhead);
  const items: BillCalendarItem[] = [];

  subscriptions.forEach((sub) => {
    if (sub.category === "Income" || sub.category === "Transfers") return;
    let next = sub.nextExpectedDate ? new Date(sub.nextExpectedDate) : null;
    if (!next || Number.isNaN(next.getTime())) {
      next = new Date(sub.lastDate);
      if (sub.cadence === "weekly") next.setDate(next.getDate() + 7);
      else if (sub.cadence === "annual") next.setFullYear(next.getFullYear() + 1);
      else next.setMonth(next.getMonth() + 1);
    }

    // Project occurrences within window
    let guard = 0;
    while (next <= end && guard < 12) {
      if (next >= now) {
        items.push({
          merchantName: sub.merchantName,
          category: sub.category,
          amount: sub.avgAmount,
          dueDate: next.toISOString(),
          cadence: sub.cadence,
          merchantKey: sub.merchantKey,
        });
      }
      if (sub.cadence === "weekly") next.setDate(next.getDate() + 7);
      else if (sub.cadence === "annual") next.setFullYear(next.getFullYear() + 1);
      else next.setMonth(next.getMonth() + 1);
      guard++;
    }
  });

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export interface RunwayResult {
  liquidAssets: number;
  avgMonthlySpend: number;
  avgMonthlyIncome: number;
  avgMonthlyNet: number;
  runwayMonths: number | null;
  monthlyBurn: number;
  cancelledMonthlySavings: number;
  projectedRunwayMonths: number | null;
  subscriptions: Array<{
    merchantKey: string;
    merchantName: string;
    monthlyCost: number;
    yearlyCost: number;
  }>;
}

function monthlyCost(sub: RecurringSubscription): number {
  if (sub.cadence === "weekly") return Math.round((sub.avgAmount * 52) / 12 * 100) / 100;
  if (sub.cadence === "annual") return Math.round((sub.avgAmount / 12) * 100) / 100;
  return sub.avgAmount;
}

export function computeRunway(opts: {
  liquidAssets: number;
  txns: Array<{ amount: number; date: Date; category?: string; isCreditCardPayment?: boolean; excludedFromTotals?: boolean }>;
  subscriptions: RecurringSubscription[];
  cancelledKeys?: string[];
  now?: Date;
}): RunwayResult {
  const now = opts.now || new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const days = Math.max(1, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const acc = { spent: 0, income: 0 };

  opts.txns.forEach((t) => {
    const d = new Date(t.date);
    if (d < start || d > now) return;
    applyMoney(t, acc);
  });

  const spend = Math.max(0, acc.spent);
  const income = acc.income;

  const months = Math.max(days / 30.44, 0.5);
  const avgMonthlySpend = Math.round((spend / months) * 100) / 100;
  const avgMonthlyIncome = Math.round((income / months) * 100) / 100;
  const avgMonthlyNet = Math.round((avgMonthlyIncome - avgMonthlySpend) * 100) / 100;
  const monthlyBurn = Math.max(avgMonthlySpend - avgMonthlyIncome, 0);

  const cancelled = new Set(opts.cancelledKeys || []);
  const subs = opts.subscriptions
    .filter((s) => s.category !== "Income" && s.category !== "Transfers")
    .map((s) => ({
      merchantKey: s.merchantKey,
      merchantName: s.merchantName,
      monthlyCost: monthlyCost(s),
      yearlyCost: s.yearlyCost,
    }));

  const cancelledMonthlySavings = Math.round(
    subs.filter((s) => cancelled.has(s.merchantKey)).reduce((a, s) => a + s.monthlyCost, 0) * 100
  ) / 100;

  const projectedBurn = Math.max(monthlyBurn - cancelledMonthlySavings, 0);
  const runwayMonths =
    monthlyBurn <= 0 ? null : Math.round((opts.liquidAssets / monthlyBurn) * 10) / 10;
  const projectedRunwayMonths =
    projectedBurn <= 0 ? null : Math.round((opts.liquidAssets / projectedBurn) * 10) / 10;

  return {
    liquidAssets: Math.round(opts.liquidAssets * 100) / 100,
    avgMonthlySpend,
    avgMonthlyIncome,
    avgMonthlyNet,
    runwayMonths,
    monthlyBurn: Math.round(monthlyBurn * 100) / 100,
    cancelledMonthlySavings,
    projectedRunwayMonths,
    subscriptions: subs.sort((a, b) => b.monthlyCost - a.monthlyCost),
  };
}

export function buildHeatmap(
  txns: Array<{ amount: number; date: Date; merchantName?: string; name?: string; category?: string; isCreditCardPayment?: boolean; excludedFromTotals?: boolean }>,
  daysBack = 90
) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - daysBack);

  const byDow = Array.from({ length: 7 }, (_, i) => ({
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
    dayIndex: i,
    spent: 0,
    count: 0,
  }));

  const byMerchant = new Map<string, number>();

  txns.forEach((t) => {
    const d = new Date(t.date);
    if (d < start || d > now) return;
    const period = { spent: 0, income: 0 };
    applyMoney(t, period);
    if (period.spent <= 0) return;
    const dow = d.getDay();
    byDow[dow].spent += period.spent;
    byDow[dow].count += 1;
    const m = (t.merchantName || t.name || "Unknown").trim();
    byMerchant.set(m, (byMerchant.get(m) || 0) + period.spent);
  });

  const merchants = Array.from(byMerchant.entries())
    .map(([merchant, spent]) => ({ merchant, spent: Math.round(spent * 100) / 100 }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 12);

  return {
    byDayOfWeek: byDow.map((d) => ({ ...d, spent: Math.round(d.spent * 100) / 100 })),
    byMerchant: merchants,
    daysBack,
  };
}
