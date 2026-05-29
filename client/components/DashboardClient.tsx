"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PlaidConnectCard from "@/components/PlaidConnectCard";
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
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, txRes, statusRes] = await Promise.all([
        api.get("/api/transactions/summary"),
        api.get("/api/transactions?limit=5"),
        api.get("/api/plaid/status"),
      ]);
      setSummary(summaryRes.data);
      setRecent(txRes.data.transactions || []);
      setPlaidConnected(statusRes.data.connected);
      setTransactionCount(statusRes.data.transactionCount ?? 0);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError(
          "Could not reach the API (auth). Sign out and back in, and confirm NEXTAUTH_SECRET matches in client and server."
        );
      } else {
        setError("Could not load dashboard data. Is the backend running on port 5000?");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8">Loading dashboard...</p>;

  const showPlaidCard = !plaidConnected || transactionCount === 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Navbar />
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {showPlaidCard && !error && (
        <div className="mb-6">
          <PlaidConnectCard connected={plaidConnected} onUpdated={load} />
        </div>
      )}

      {summary && (
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
