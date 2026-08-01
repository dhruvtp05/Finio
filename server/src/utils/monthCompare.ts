import { applyMoney } from "./txnMoney";

export interface MonthPeriodMetrics {
  key: string;
  label: string;
  spent: number;
  income: number;
  net: number;
  byCategory: Array<{ category: string; total: number }>;
}

export interface MonthCompareResult {
  current: MonthPeriodMetrics;
  previousMonth: MonthPeriodMetrics;
  sameMonthLastYear: MonthPeriodMetrics;
  vsPreviousMonth: {
    spentDelta: number;
    spentDeltaPercent: number | null;
    incomeDelta: number;
    incomeDeltaPercent: number | null;
    netDelta: number;
  };
  vsSameMonthLastYear: {
    spentDelta: number;
    spentDeltaPercent: number | null;
    incomeDelta: number;
    incomeDeltaPercent: number | null;
    netDelta: number;
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function monthLabel(y: number, m: number) {
  return new Date(y, m, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

function monthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function rangeFor(y: number, m: number) {
  return {
    start: new Date(y, m, 1),
    end: new Date(y, m + 1, 1),
  };
}

function metricsForPeriod(
  txns: Array<{
    amount: number;
    date: Date;
    category: string;
    excludedFromTotals?: boolean;
    isCreditCardPayment?: boolean;
  }>,
  y: number,
  m: number
): MonthPeriodMetrics {
  const { start, end } = rangeFor(y, m);
  const acc = { spent: 0, income: 0 };
  const categoryMap = new Map<string, number>();

  txns.forEach((txn) => {
    const date = new Date(txn.date);
    if (date < start || date >= end) return;
    applyMoney(txn, acc, (category, delta) => {
      categoryMap.set(category, (categoryMap.get(category) || 0) + delta);
    });
  });

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total: round2(total) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    key: monthKey(y, m),
    label: monthLabel(y, m),
    spent: round2(Math.max(0, acc.spent)),
    income: round2(acc.income),
    net: round2(acc.income - acc.spent),
    byCategory,
  };
}

export function computeMonthCompare(
  txns: Array<{
    amount: number;
    date: Date;
    category: string;
    excludedFromTotals?: boolean;
    isCreditCardPayment?: boolean;
  }>,
  now = new Date()
): MonthCompareResult {
  const y = now.getFullYear();
  const m = now.getMonth();

  const current = metricsForPeriod(txns, y, m);
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 11 : m - 1;
  const previousMonth = metricsForPeriod(txns, prevY, prevM);
  const sameMonthLastYear = metricsForPeriod(txns, y - 1, m);

  return {
    current,
    previousMonth,
    sameMonthLastYear,
    vsPreviousMonth: {
      spentDelta: round2(current.spent - previousMonth.spent),
      spentDeltaPercent: pctDelta(current.spent, previousMonth.spent),
      incomeDelta: round2(current.income - previousMonth.income),
      incomeDeltaPercent: pctDelta(current.income, previousMonth.income),
      netDelta: round2(current.net - previousMonth.net),
    },
    vsSameMonthLastYear: {
      spentDelta: round2(current.spent - sameMonthLastYear.spent),
      spentDeltaPercent: pctDelta(current.spent, sameMonthLastYear.spent),
      incomeDelta: round2(current.income - sameMonthLastYear.income),
      incomeDeltaPercent: pctDelta(current.income, sameMonthLastYear.income),
      netDelta: round2(current.net - sameMonthLastYear.net),
    },
  };
}
