"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import TransactionTable, { Txn } from "@/components/TransactionTable";
import api from "@/lib/api";

export default function TransactionsClient() {
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (category) params.set("category", category);
    const res = await api.get(`/api/transactions?${params.toString()}`);
    setTransactions(res.data.transactions || []);
  };

  useEffect(() => {
    load().catch(() => setTransactions([]));
  }, [month, category]);

  const months = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(format(new Date(t.date), "yyyy-MM")));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.category?.[0] && set.add(t.category[0]));
    return Array.from(set).sort();
  }, [transactions]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Navbar />
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="rounded border px-3 py-2" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select className="rounded border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <TransactionTable transactions={transactions} />
    </div>
  );
}
