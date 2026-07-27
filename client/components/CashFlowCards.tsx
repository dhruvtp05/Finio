"use client";

import StatCard from "@/components/ui/StatCard";
import { CashFlowDto } from "@/lib/types";

function pct(n: number | null) {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

export default function CashFlowCards({ cashFlow }: { cashFlow: CashFlowDto }) {
  const netPositive = cashFlow.netThisMonth >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Money in (this month)"
        value={`$${cashFlow.moneyInThisMonth.toFixed(2)}`}
        hint="Deposits & income"
        valueClassName="text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        title="Money out (this month)"
        value={`$${cashFlow.moneyOutThisMonth.toFixed(2)}`}
        hint="Spending & bills"
        valueClassName="text-slate-900 dark:text-slate-100"
      />
      <StatCard
        title="Savings rate"
        value={pct(cashFlow.savingsRatePercent)}
        hint={`Net ${netPositive ? "+" : ""}$${cashFlow.netThisMonth.toFixed(2)} this month`}
        valueClassName={netPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
      />
      <StatCard
        title="Avg daily spend"
        value={`$${cashFlow.avgDailySpend.toFixed(2)}`}
        hint={`Day ${cashFlow.daysElapsedInMonth} of month`}
      />
      <StatCard
        title="Net worth"
        value={`$${cashFlow.netWorth.toFixed(2)}`}
        hint={
          cashFlow.netWorthSource === "accounts"
            ? `Assets $${(cashFlow.assets ?? 0).toFixed(0)} − liabilities $${(cashFlow.liabilities ?? 0).toFixed(0)}`
            : "Lifetime income minus spending (connect Plaid for live balances)"
        }
        className="sm:col-span-2 lg:col-span-4"
        valueClassName={cashFlow.netWorth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}
      />
    </div>
  );
}
