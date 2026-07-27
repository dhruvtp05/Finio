"use client";

import { MonthCompareDto } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Delta({ value, percent }: { value: number; percent: number | null }) {
  const up = value > 0;
  const flat = value === 0;
  const color = flat ? "text-slate-500" : up ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-medium ${color}`}>
      {sign}
      {currency.format(value)}
      {percent !== null ? ` (${sign}${percent}%)` : ""}
    </span>
  );
}

export default function MonthCompareCard({ compare }: { compare: MonthCompareDto }) {
  const { current, previousMonth, sameMonthLastYear, vsPreviousMonth, vsSameMonthLastYear } = compare;

  return (
    <div className="finio-card">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Month comparison</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {current.label} vs last month and same month last year
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{current.label}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Spent</p>
          <p className="text-xl font-bold">{currency.format(current.spent)}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Income</p>
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{currency.format(current.income)}</p>
        </div>

        <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">vs {previousMonth.label}</p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Spending</p>
          <p className="text-sm">
            <Delta value={vsPreviousMonth.spentDelta} percent={vsPreviousMonth.spentDeltaPercent} />
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Income</p>
          <p className="text-sm">
            <Delta value={vsPreviousMonth.incomeDelta} percent={vsPreviousMonth.incomeDeltaPercent} />
          </p>
          <p className="mt-2 text-xs text-slate-400">Prior spent {currency.format(previousMonth.spent)}</p>
        </div>

        <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">vs {sameMonthLastYear.label}</p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Spending</p>
          <p className="text-sm">
            <Delta value={vsSameMonthLastYear.spentDelta} percent={vsSameMonthLastYear.spentDeltaPercent} />
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Income</p>
          <p className="text-sm">
            <Delta value={vsSameMonthLastYear.incomeDelta} percent={vsSameMonthLastYear.incomeDeltaPercent} />
          </p>
          <p className="mt-2 text-xs text-slate-400">YoY spent {currency.format(sameMonthLastYear.spent)}</p>
        </div>
      </div>
    </div>
  );
}
