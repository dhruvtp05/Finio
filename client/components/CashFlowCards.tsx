"use client";

import StatCard from "@/components/ui/StatCard";
import { CashFlowDto } from "@/lib/types";

function pct(n: number | null) {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

export default function CashFlowCards({
  cashFlow,
  customRange = false,
}: {
  cashFlow: CashFlowDto;
  customRange?: boolean;
}) {
  const netPositive = cashFlow.netThisMonth >= 0;
  const rangeHint = customRange ? "In range" : "This month";

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Money in"
        value={`$${cashFlow.moneyInThisMonth.toFixed(2)}`}
        hint={rangeHint}
        valueClassName="text-emerald-600 dark:text-emerald-400"
      />
      <StatCard
        title="Money out"
        value={`$${cashFlow.moneyOutThisMonth.toFixed(2)}`}
        hint={rangeHint}
      />
      <StatCard
        title="Savings rate"
        value={pct(cashFlow.savingsRatePercent)}
        hint={`Net ${netPositive ? "+" : ""}$${cashFlow.netThisMonth.toFixed(2)}`}
        valueClassName={netPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}
      />
      <StatCard
        title="Avg daily spend"
        value={`$${cashFlow.avgDailySpend.toFixed(2)}`}
        hint={customRange ? rangeHint : `Day ${cashFlow.daysElapsedInMonth}`}
      />
    </div>
  );
}
