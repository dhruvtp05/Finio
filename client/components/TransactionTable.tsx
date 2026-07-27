"use client";

import { format } from "date-fns";
import { useState } from "react";
import { TransactionDto } from "@/lib/types";
import { FINIO_CATEGORIES } from "@/lib/categories";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatDisplayAmount(amount: number) {
  if (amount > 0) return currency.format(-amount);
  if (amount < 0) return `+${currency.format(Math.abs(amount))}`;
  return currency.format(0);
}

function displayCategory(txn: TransactionDto) {
  return txn.userCategory || txn.suggestedCategory || txn.category?.[0] || "Other";
}

export default function TransactionTable({
  transactions,
  onRecategorize,
  onDelete,
  onSplit,
}: {
  transactions: TransactionDto[];
  onRecategorize?: (id: string, category: string) => void;
  onDelete?: (id: string) => void;
  onSplit?: (id: string, parts: Array<{ amount: number; category: string; name?: string }>) => void;
}) {
  const [splitId, setSplitId] = useState<string | null>(null);
  const [partA, setPartA] = useState("");
  const [catA, setCatA] = useState<string>(FINIO_CATEGORIES[0]);
  const [catB, setCatB] = useState<string>(FINIO_CATEGORIES[1] || FINIO_CATEGORIES[0]);

  const startSplit = (txn: TransactionDto) => {
    setSplitId(txn._id);
    const half = (Math.abs(txn.amount) / 2).toFixed(2);
    setPartA(half);
    setCatA(displayCategory(txn));
    setCatB(FINIO_CATEGORIES.find((c) => c !== displayCategory(txn)) || "Other");
  };

  const submitSplit = (txn: TransactionDto) => {
    if (!onSplit) return;
    const total = Math.abs(txn.amount);
    const a = Number(partA);
    if (!(a > 0) || a >= total) return;
    const b = Math.round((total - a) * 100) / 100;
    onSplit(txn._id, [
      { amount: a, category: catA },
      { amount: b, category: catB },
    ]);
    setSplitId(null);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Merchant</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Amount</th>
            {(onDelete || onSplit) && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => {
            const expense = txn.amount > 0;
            const category = displayCategory(txn);
            const isSplitting = splitId === txn._id;

            return (
              <tr key={txn._id} className="border-t border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50">
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{format(new Date(txn.date), "MMM d, yyyy")}</td>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                  <span>{txn.merchantName || txn.name || "—"}</span>
                  {txn.source === "manual" && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800">
                      Manual
                    </span>
                  )}
                  {txn.categoryLocked && (
                    <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                      Locked
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {onRecategorize ? (
                    <select
                      className="finio-input max-w-[200px]"
                      value={category}
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
                  {isSplitting && onSplit && (
                    <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <p className="text-xs text-slate-500">Split into 2 parts (must sum to {currency.format(Math.abs(txn.amount))})</p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="finio-input w-24"
                          type="number"
                          step="0.01"
                          value={partA}
                          onChange={(e) => setPartA(e.target.value)}
                          placeholder="Part 1"
                        />
                        <select className="finio-input" value={catA} onChange={(e) => setCatA(e.target.value)}>
                          {FINIO_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="self-center text-xs text-slate-500">
                          Rest: {currency.format(Math.max(0, Math.abs(txn.amount) - Number(partA || 0)))}
                        </span>
                        <select className="finio-input" value={catB} onChange={(e) => setCatB(e.target.value)}>
                          {FINIO_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="finio-btn-primary text-xs" onClick={() => submitSplit(txn)}>
                          Confirm split
                        </button>
                        <button type="button" className="finio-btn-secondary text-xs" onClick={() => setSplitId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${expense ? "text-red-600" : "text-emerald-600"}`}>
                  {formatDisplayAmount(txn.amount)}
                </td>
                {(onDelete || onSplit) && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {onSplit && !isSplitting && (
                        <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => startSplit(txn)}>
                          Split
                        </button>
                      )}
                      {onDelete && txn.source === "manual" && (
                        <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => onDelete(txn._id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
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
