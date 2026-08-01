import { effectiveCategory } from "../services/categorization";
import { ITransactionDocument } from "../models/Transaction";
import { applyMoney } from "./txnMoney";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? 6 : day - 1; // Monday start
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - diff);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function sumSpend(txns: ITransactionDocument[], start: Date, end: Date) {
  const acc = { spent: 0, income: 0 };
  txns.forEach((t) => {
    const date = new Date(t.date);
    if (date < start || date >= end) return;
    applyMoney(
      {
        amount: t.amount,
        category: effectiveCategory(t),
        isCreditCardPayment: t.isCreditCardPayment,
        excludedFromTotals: t.excludedFromTotals,
      },
      acc
    );
  });
  return { spent: round2(acc.spent), income: round2(acc.income) };
}

export interface WeeklyDigest {
  weekLabel: string;
  thisWeek: { spent: number; income: number; net: number };
  lastWeek: { spent: number; income: number; net: number };
  spentDelta: number;
  spentDeltaPercent: number | null;
  topMerchants: Array<{ name: string; total: number }>;
  budgetWarnings: Array<{ label: string; pct: number }>;
  highlights: string[];
}

export function buildWeeklyDigest(
  txns: ITransactionDocument[],
  budgets: Array<{ label: string; limit: number; spent: number }>,
  now = new Date()
): WeeklyDigest {
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const lastStart = addDays(weekStart, -7);
  const lastEnd = weekStart;

  const thisWeek = sumSpend(txns, weekStart, weekEnd);
  const lastWeek = sumSpend(txns, lastStart, lastEnd);

  const merchantMap = new Map<string, number>();
  txns.forEach((t) => {
    const date = new Date(t.date);
    if (date < weekStart || date >= weekEnd) return;
    const cat = effectiveCategory(t);
    const acc = { spent: 0, income: 0 };
    applyMoney(
      {
        amount: t.amount,
        category: cat,
        isCreditCardPayment: t.isCreditCardPayment,
        excludedFromTotals: t.excludedFromTotals,
      },
      acc
    );
    if (acc.spent === 0) return;
    const name = (t.merchantName || t.name || "Unknown").trim();
    merchantMap.set(name, (merchantMap.get(name) || 0) + acc.spent);
  });

  const topMerchants = Array.from(merchantMap.entries())
    .map(([name, total]) => ({ name, total: round2(total) }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const budgetWarnings = budgets
    .filter((b) => b.limit > 0 && b.spent / b.limit >= 0.8)
    .map((b) => ({ label: b.label, pct: Math.round((b.spent / b.limit) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const spentDelta = round2(thisWeek.spent - lastWeek.spent);
  const spentDeltaPercent =
    lastWeek.spent === 0 ? (thisWeek.spent === 0 ? 0 : null) : round2(((thisWeek.spent - lastWeek.spent) / lastWeek.spent) * 100);

  const highlights: string[] = [];
  if (spentDeltaPercent !== null) {
    if (spentDeltaPercent <= -10) highlights.push(`Spending is down ${Math.abs(spentDeltaPercent)}% vs last week.`);
    else if (spentDeltaPercent >= 10) highlights.push(`Spending is up ${spentDeltaPercent}% vs last week.`);
    else highlights.push("Spending is roughly flat vs last week.");
  }
  if (topMerchants[0]) {
    highlights.push(`Top merchant this week: ${topMerchants[0].name} ($${topMerchants[0].total.toFixed(0)}).`);
  }
  if (budgetWarnings.length) {
    highlights.push(`${budgetWarnings.length} budget${budgetWarnings.length > 1 ? "s" : ""} at 80%+ for the month.`);
  } else {
    highlights.push("No budgets over 80% so far this month.");
  }

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(weekEnd, -1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return {
    weekLabel,
    thisWeek: { ...thisWeek, net: round2(thisWeek.income - thisWeek.spent) },
    lastWeek: { ...lastWeek, net: round2(lastWeek.income - lastWeek.spent) },
    spentDelta,
    spentDeltaPercent,
    topMerchants,
    budgetWarnings,
    highlights,
  };
}

export interface MerchantInsight {
  merchantKey: string;
  merchantName: string;
  total: number;
  count: number;
  lastDate: string;
  category: string;
}

function normalizeMerchant(name: string) {
  return name.trim().toLowerCase().replace(/\s+#?\d+$/, "").replace(/\s+/g, " ");
}

export function buildMerchantInsights(
  txns: ITransactionDocument[],
  opts: { year?: number; search?: string; limit?: number } = {}
): MerchantInsight[] {
  const { year, search, limit = 25 } = opts;
  const q = search?.trim().toLowerCase();
  const byKey = new Map<string, { name: string; total: number; count: number; last: Date; category: string }>();

  txns.forEach((t) => {
    const date = new Date(t.date);
    if (year && date.getFullYear() !== year) return;
    const cat = effectiveCategory(t);
    const acc = { spent: 0, income: 0 };
    applyMoney(
      {
        amount: t.amount,
        category: cat,
        isCreditCardPayment: t.isCreditCardPayment,
        excludedFromTotals: t.excludedFromTotals,
      },
      acc
    );
    if (acc.spent === 0) return;

    const display = (t.merchantName || t.name || "Unknown").trim();
    const key = normalizeMerchant(display);
    if (!key) return;
    if (q && !key.includes(q) && !display.toLowerCase().includes(q)) return;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { name: display, total: acc.spent, count: acc.spent > 0 ? 1 : 0, last: date, category: cat });
    } else {
      existing.total += acc.spent;
      if (acc.spent > 0) existing.count += 1;
      if (date > existing.last) {
        existing.last = date;
        existing.name = display;
        existing.category = cat;
      }
    }
  });

  return Array.from(byKey.entries())
    .map(([merchantKey, v]) => ({
      merchantKey,
      merchantName: v.name,
      total: round2(v.total),
      count: v.count,
      lastDate: v.last.toISOString(),
      category: v.category,
    }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function buildTaxExportRows(
  txns: ITransactionDocument[],
  year: number
): Array<{ category: string; total: number; count: number }> {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const map = new Map<string, { total: number; count: number }>();

  txns.forEach((t) => {
    const date = new Date(t.date);
    if (date < start || date >= end) return;
    const cat = effectiveCategory(t);
    const acc = { spent: 0, income: 0 };
    applyMoney(
      {
        amount: t.amount,
        category: cat,
        isCreditCardPayment: t.isCreditCardPayment,
        excludedFromTotals: t.excludedFromTotals,
      },
      acc,
      (category, delta) => {
        const cur = map.get(category) || { total: 0, count: 0 };
        cur.total += delta;
        if (delta > 0) cur.count += 1;
        map.set(category, cur);
      }
    );
  });

  return Array.from(map.entries())
    .map(([category, v]) => ({ category, total: round2(v.total), count: v.count }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}
