"use client";

import { format } from "date-fns";

export type Txn = {
  _id: string;
  date: string;
  merchantName?: string;
  name?: string;
  category?: string[];
  amount: number;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function TransactionTable({ transactions }: { transactions: Txn[] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-slate-700">
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
            return (
              <tr key={txn._id} className="border-b">
                <td className="px-4 py-3">{format(new Date(txn.date), "MMM d, yyyy")}</td>
                <td className="px-4 py-3">{txn.merchantName || txn.name || "-"}</td>
                <td className="px-4 py-3">{txn.category?.[0] || "Uncategorized"}</td>
                <td className={`px-4 py-3 text-right font-medium ${expense ? "text-red-600" : "text-green-600"}`}>
                  {currency.format(txn.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {transactions.length === 0 && <p className="p-4 text-sm text-slate-500">No transactions found.</p>}
    </div>
  );
}
