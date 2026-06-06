"use client";

import { format } from "date-fns";
import { TransactionDto } from "@/lib/types";
import { FINIO_CATEGORIES } from "@/lib/categories";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Plaid: positive = expense, negative = income. Display as −spend / +income. */
function formatDisplayAmount(amount: number) {
  if (amount > 0) {
    return currency.format(-amount);
  }
  if (amount < 0) {
    return `+${currency.format(Math.abs(amount))}`;
  }
  return currency.format(0);
}

function displayCategory(txn: TransactionDto) {
  return txn.userCategory || txn.suggestedCategory || txn.category?.[0] || "Other";
}

export default function TransactionTable({
  transactions,
  onRecategorize,
}: {
  transactions: TransactionDto[];
  onRecategorize?: (id: string, category: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Merchant</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const expense = txn.amount > 0;
            const category = displayCategory(txn);

            return (
              <tr key={txn._id} className="border-t border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{format(new Date(txn.date), "MMM d, yyyy")}</td>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{txn.merchantName || txn.name || "—"}</td>
                <td className="px-4 py-3">
                  {onRecategorize ? (
                    <select
                      className="finio-input max-w-[200px]"
                      defaultValue={category}
                      onChange={(e) => onRecategorize(txn._id, e.target.value)}
                    >
                      {FINIO_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{category}</span>
                  )}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${expense ? "text-red-600" : "text-emerald-600"}`}>
                  {formatDisplayAmount(txn.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">No transactions found.</p>
      )}
    </div>
  );
}
