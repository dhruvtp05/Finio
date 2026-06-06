"use client";

import { format } from "date-fns";
import { RecurringSubscriptionDto } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function RecurringCard({ subscriptions }: { subscriptions: RecurringSubscriptionDto[] }) {
  return (
    <div className="finio-card h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Subscriptions & recurring</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Merchants that repeat on a monthly or weekly cadence, detected from your history.
        </p>
      </div>

      {subscriptions.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No recurring charges detected yet. Connect Plaid and sync a few months of transactions.
        </p>
      ) : (
        <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {subscriptions.map((sub) => (
            <li
              key={sub.merchantKey}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800 dark:text-slate-100">{sub.merchantName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {sub.category} · {sub.cadence} · {sub.occurrenceCount} charges · {sub.monthsActive} mo.
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Last: {format(new Date(sub.lastDate), "MMM d, yyyy")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-indigo-600 dark:text-indigo-400">{currency.format(sub.avgAmount)}</p>
                <p className="text-xs text-slate-400">avg / charge</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
