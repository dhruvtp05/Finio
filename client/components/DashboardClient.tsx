"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PlaidLinkButton from "@/components/PlaidLinkButton";
import SpendingChart from "@/components/SpendingChart";
import BudgetCard from "@/components/BudgetCard";
import TransactionTable, { Txn } from "@/components/TransactionTable";
import api from "@/lib/api";

type Summary = {
  totalSpent: number;
  totalIncome: number;
  byCategory: Array<{ category: string; total: number }>;
  byMonth: Array<{ month: string; spent: number }>;
};

export default function DashboardClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPlaid, setHasPlaid] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [summaryRes, txRes] = await Promise.all([
        api.get("/api/transactions/summary"),
        api.get("/api/transactions?limit=5"),
      ]);
      setSummary(summaryRes.data);
      setRecent(txRes.data.transactions || []);
      setHasPlaid(true);
    } catch {
      setHasPlaid(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8">Loading dashboard...</p>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Navbar />
      {!hasPlaid && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Connect your account</h2>
          <p className="mt-2 text-sm text-slate-600">Link a bank account to begin syncing transactions.</p>
          <div className="mt-4">
            <PlaidLinkButton onConnected={load} />
          </div>
        </div>
      )}
      {hasPlaid && summary && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard title="Total Spent This Month" value={`$${summary.totalSpent.toFixed(2)}`} />
            <StatCard title="Total Income" value={`$${summary.totalIncome.toFixed(2)}`} />
            <StatCard title="Top Category" value={summary.byCategory[0]?.category || "N/A"} />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SpendingChart data={summary.byMonth.slice(-6)} />
            </div>
            <BudgetCard byCategory={summary.byCategory} />
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Transactions</h3>
              <Link href="/transactions" className="text-indigo-600 hover:underline">
                View all
              </Link>
            </div>
            <TransactionTable transactions={recent} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
