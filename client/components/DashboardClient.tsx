"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import PlaidConnectCard from "@/components/PlaidConnectCard";
import SpendingChart from "@/components/SpendingChart";
import BudgetCard from "@/components/BudgetCard";
import TransactionTable from "@/components/TransactionTable";
import CashFlowCards from "@/components/CashFlowCards";
import GoalsCard from "@/components/GoalsCard";
import AlertsBanner from "@/components/AlertsBanner";
import AccountsCard from "@/components/AccountsCard";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { PlaidLinkProvider } from "@/context/PlaidLinkContext";
import api from "@/lib/api";
import {
  AccountsDto,
  AlertDto,
  BudgetDto,
  CashFlowDto,
  GoalDto,
  TransactionDto,
  TransactionSummary,
} from "@/lib/types";

function thisMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** Exclusive end = day after selected end date (ISO midnight). */
function exclusiveEndIso(endDate: string) {
  const d = new Date(`${endDate}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export default function DashboardClient() {
  const { data: session } = useSession();
  const month = thisMonthBounds();
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowDto | null>(null);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [recent, setRecent] = useState<TransactionDto[]>([]);
  const [budgets, setBudgets] = useState<BudgetDto[]>([]);
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [accounts, setAccounts] = useState<AccountsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  const [error, setError] = useState("");
  const [rangeStart, setRangeStart] = useState(month.start);
  const [rangeEnd, setRangeEnd] = useState(month.end);
  const [appliedStart, setAppliedStart] = useState(month.start);
  const [appliedEnd, setAppliedEnd] = useState(month.end);
  const [customRange, setCustomRange] = useState(false);

  const loadCashFlow = async (start: string, end: string, isCustom: boolean) => {
    const params = isCustom
      ? `?start=${encodeURIComponent(new Date(`${start}T00:00:00`).toISOString())}&end=${encodeURIComponent(exclusiveEndIso(end))}`
      : "";
    const cashFlowRes = await api.get<CashFlowDto>(`/api/transactions/cashflow${params}`);
    setCashFlow(cashFlowRes.data);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const cashParams = customRange
        ? `?start=${encodeURIComponent(new Date(`${appliedStart}T00:00:00`).toISOString())}&end=${encodeURIComponent(exclusiveEndIso(appliedEnd))}`
        : "";
      const [summaryRes, cashFlowRes, txRes, statusRes, budgetsRes, goalsRes, alertsRes, accountsRes] =
        await Promise.all([
          api.get<TransactionSummary>("/api/transactions/summary"),
          api.get<CashFlowDto>(`/api/transactions/cashflow${cashParams}`),
          api.get<{ transactions: TransactionDto[] }>("/api/transactions?limit=5"),
          api.get<{ connected: boolean; transactionCount: number }>("/api/plaid/status"),
          api.get<BudgetDto[]>("/api/budgets"),
          api.get<GoalDto[]>("/api/goals"),
          api.get<{ alerts: AlertDto[] }>("/api/alerts"),
          api.get<AccountsDto>("/api/accounts"),
        ]);
      setSummary(summaryRes.data);
      setCashFlow(cashFlowRes.data);
      setRecent(txRes.data.transactions || []);
      setPlaidConnected(statusRes.data.connected);
      setTransactionCount(statusRes.data.transactionCount ?? 0);
      setBudgets(budgetsRes.data);
      setGoals(goalsRes.data);
      setAlerts(alertsRes.data.alerts || []);
      setAccounts(accountsRes.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 401
          ? "Auth error — sign out and back in. Confirm NEXTAUTH_SECRET matches in client and server."
          : "Could not load dashboard. Is the backend running on port 5000?"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    api
      .post("/api/users/sync-profile", {
        name: session.user.name,
        image: session.user.image,
      })
      .catch(() => undefined);
  }, [session]);

  const applyRange = async () => {
    if (!rangeStart || !rangeEnd) {
      toast.error("Pick start and end dates");
      return;
    }
    if (rangeStart > rangeEnd) {
      toast.error("Start must be on or before end");
      return;
    }
    const bounds = thisMonthBounds();
    const isCustom = rangeStart !== bounds.start || rangeEnd !== bounds.end;
    setAppliedStart(rangeStart);
    setAppliedEnd(rangeEnd);
    setCustomRange(isCustom);
    try {
      await loadCashFlow(rangeStart, rangeEnd, isCustom);
    } catch {
      toast.error("Failed to load cash flow for range");
    }
  };

  const resetRange = async () => {
    const bounds = thisMonthBounds();
    setRangeStart(bounds.start);
    setRangeEnd(bounds.end);
    setAppliedStart(bounds.start);
    setAppliedEnd(bounds.end);
    setCustomRange(false);
    try {
      await loadCashFlow(bounds.start, bounds.end, false);
    } catch {
      toast.error("Failed to reset cash flow");
    }
  };

  const showPlaidCard = !plaidConnected || transactionCount === 0;
  const topCategory = summary?.byCategory?.find((c) => c.category !== "Transfers")?.category || summary?.byCategory?.[0]?.category;

  return (
    <PlaidLinkProvider onConnected={load}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Navbar />
        {error && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>
        )}

        {loading && <DashboardSkeleton />}

        {!loading && (
          <>
            <AlertsBanner alerts={alerts} onDismissed={load} />

            {showPlaidCard && !error && (
              <div className="mb-6">
                <PlaidConnectCard connected={plaidConnected} onUpdated={load} />
              </div>
            )}

            {summary && cashFlow && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {customRange ? "Custom range" : "This month"}
                  </h2>
                  <Link
                    href="/insights"
                    className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    Digests, merchants & more →
                  </Link>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">Start</label>
                    <input
                      type="date"
                      className="finio-input py-1.5 text-xs"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">End</label>
                    <input
                      type="date"
                      className="finio-input py-1.5 text-xs"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={applyRange} className="finio-btn-primary py-1.5 text-xs">
                    Apply
                  </button>
                  <button type="button" onClick={resetRange} className="finio-btn-secondary py-1.5 text-xs">
                    Reset
                  </button>
                </div>

                <CashFlowCards cashFlow={cashFlow} customRange={customRange} />

                {topCategory && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Top category: <span className="font-medium text-slate-800 dark:text-slate-200">{topCategory}</span>
                    {plaidConnected && !showPlaidCard && (
                      <>
                        {" · "}
                        <Link href="/settings" className="text-indigo-600 hover:underline dark:text-indigo-400">
                          Manage bank
                        </Link>
                      </>
                    )}
                  </p>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <SpendingChart />
                  </div>
                  <BudgetCard budgets={budgets} onUpdated={load} />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <GoalsCard goals={goals} onUpdated={load} />
                  <AccountsCard data={accounts} onUpdated={load} compact />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Recent transactions</h3>
                    <Link href="/transactions" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      View all →
                    </Link>
                  </div>
                  <TransactionTable transactions={recent} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PlaidLinkProvider>
  );
}
