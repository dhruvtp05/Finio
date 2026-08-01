import { applyMoney } from "./txnMoney";

export interface CashFlowMetrics {
  moneyInThisMonth: number;
  moneyOutThisMonth: number;
  netThisMonth: number;
  savingsRatePercent: number | null;
  avgDailySpend: number;
  netWorth: number;
  daysElapsedInMonth: number;
  rangeStart?: string;
  rangeEnd?: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeCashFlowMetrics(
  txns: Array<{ amount: number; date: Date; category?: string; isCreditCardPayment?: boolean; excludedFromTotals?: boolean }>,
  opts?: { start?: Date; end?: Date; now?: Date }
): CashFlowMetrics {
  const now = opts?.now || new Date();
  const start = opts?.start || new Date(now.getFullYear(), now.getMonth(), 1);
  const end = opts?.end || new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysElapsed = Math.max(1, Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / (1000 * 60 * 60 * 24)));

  let moneyInThisMonth = 0;
  let moneyOutThisMonth = 0;
  const allTime = { spent: 0, income: 0 };

  txns.forEach((txn) => {
    const date = new Date(txn.date);
    const inRange = date >= start && date < end;
    const before = { spent: allTime.spent, income: allTime.income };
    applyMoney(txn, allTime);
    if (inRange) {
      moneyOutThisMonth += allTime.spent - before.spent;
      moneyInThisMonth += allTime.income - before.income;
    }
  });

  const netThisMonth = moneyInThisMonth - moneyOutThisMonth;
  const savingsRatePercent =
    moneyInThisMonth > 0 ? Math.round((netThisMonth / moneyInThisMonth) * 1000) / 10 : null;
  const avgDailySpend = Math.max(0, moneyOutThisMonth) / daysElapsed;
  const netWorth = allTime.income - allTime.spent;

  return {
    moneyInThisMonth: round2(moneyInThisMonth),
    moneyOutThisMonth: round2(Math.max(0, moneyOutThisMonth)),
    netThisMonth: round2(netThisMonth),
    savingsRatePercent,
    avgDailySpend: round2(avgDailySpend),
    netWorth: round2(netWorth),
    daysElapsedInMonth: daysElapsed,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
  };
}

export function computeGoalProgress(
  txns: Array<{ amount: number; date: Date; category?: string; isCreditCardPayment?: boolean; excludedFromTotals?: boolean }>,
  goalStart: Date,
  deadline: Date,
  now = new Date()
): number {
  const end = now < deadline ? now : deadline;
  const acc = { spent: 0, income: 0 };

  txns.forEach((txn) => {
    const date = new Date(txn.date);
    if (date < goalStart || date > end) return;
    applyMoney(txn, acc);
  });

  return Math.max(0, Math.round((acc.income - acc.spent) * 100) / 100);
}
