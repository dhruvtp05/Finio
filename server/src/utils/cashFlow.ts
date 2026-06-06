export interface CashFlowMetrics {
  moneyInThisMonth: number;
  moneyOutThisMonth: number;
  netThisMonth: number;
  savingsRatePercent: number | null;
  avgDailySpend: number;
  netWorth: number;
  daysElapsedInMonth: number;
}

export function computeCashFlowMetrics(
  txns: Array<{ amount: number; date: Date }>,
  now = new Date()
): CashFlowMetrics {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysElapsed = Math.max(now.getDate(), 1);

  let moneyInThisMonth = 0;
  let moneyOutThisMonth = 0;
  let totalIncome = 0;
  let totalSpent = 0;

  txns.forEach((txn) => {
    const date = new Date(txn.date);
    const inMonth = date >= start && date < end;

    if (txn.amount > 0) {
      totalSpent += txn.amount;
      if (inMonth) moneyOutThisMonth += txn.amount;
    } else {
      const income = Math.abs(txn.amount);
      totalIncome += income;
      if (inMonth) moneyInThisMonth += income;
    }
  });

  const netThisMonth = moneyInThisMonth - moneyOutThisMonth;
  const savingsRatePercent =
    moneyInThisMonth > 0 ? Math.round((netThisMonth / moneyInThisMonth) * 1000) / 10 : null;
  const avgDailySpend = moneyOutThisMonth / daysElapsed;
  const netWorth = totalIncome - totalSpent;

  return {
    moneyInThisMonth: round2(moneyInThisMonth),
    moneyOutThisMonth: round2(moneyOutThisMonth),
    netThisMonth: round2(netThisMonth),
    savingsRatePercent,
    avgDailySpend: round2(avgDailySpend),
    netWorth: round2(netWorth),
    daysElapsedInMonth: daysElapsed,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeGoalProgress(
  txns: Array<{ amount: number; date: Date }>,
  goalStart: Date,
  deadline: Date,
  now = new Date()
): number {
  const end = now < deadline ? now : deadline;
  let income = 0;
  let spent = 0;

  txns.forEach((txn) => {
    const date = new Date(txn.date);
    if (date < goalStart || date > end) return;
    if (txn.amount > 0) spent += txn.amount;
    else income += Math.abs(txn.amount);
  });

  return Math.max(0, Math.round((income - spent) * 100) / 100);
}
