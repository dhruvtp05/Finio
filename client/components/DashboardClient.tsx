"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import PlaidConnectCard from "@/components/PlaidConnectCard";
import SpendingChart from "@/components/SpendingChart";
import BudgetCard from "@/components/BudgetCard";
import TransactionTable from "@/components/TransactionTable";
import CashFlowCards from "@/components/CashFlowCards";
import RecurringCard from "@/components/RecurringCard";
import GoalsCard from "@/components/GoalsCard";
import AlertsBanner from "@/components/AlertsBanner";
import MonthCompareCard from "@/components/MonthCompareCard";
import AccountsCard from "@/components/AccountsCard";
import StatCard from "@/components/ui/StatCard";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { PlaidLinkProvider } from "@/context/PlaidLinkContext";
import api from "@/lib/api";
import {
  AccountsDto,
  AlertDto,
  BudgetDto,
  CashFlowDto,
  GoalDto,
  MonthCompareDto,
  RecurringDto,
  TransactionDto,
  TransactionSummary,
} from "@/lib/types";

export default function DashboardClient() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowDto | null>(null);
  const [recurring, setRecurring] = useState<RecurringDto["subscriptions"]>([]);
  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [recent, setRecent] = useState<TransactionDto[]>([]);
  const [budgets, setBudgets] = useState<BudgetDto[]>([]);
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [compare, setCompare] = useState<MonthCompareDto | null>(null);
  const [accounts, setAccounts] = useState<AccountsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [
        summaryRes,
        cashFlowRes,
        recurringRes,
        txRes,
        statusRes,
        budgetsRes,
        goalsRes,
        alertsRes,
        compareRes,
        accountsRes,
      ] = await Promise.all([
        api.get<TransactionSummary>("/api/transactions/summary"),
        api.get<CashFlowDto>("/api/transactions/cashflow"),
        api.get<RecurringDto>("/api/transactions/recurring"),
        api.get<{ transactions: TransactionDto[] }>("/api/transactions?limit=5"),
        api.get<{ connected: boolean; transactionCount: number }>("/api/plaid/status"),
        api.get<BudgetDto[]>("/api/budgets"),
        api.get<GoalDto[]>("/api/goals"),
        api.get<{ alerts: AlertDto[] }>("/api/alerts"),
        api.get<MonthCompareDto>("/api/transactions/compare"),
        api.get<AccountsDto>("/api/accounts"),
      ]);
      setSummary(summaryRes.data);
      setCashFlow(cashFlowRes.data);
      setRecurring(recurringRes.data.subscriptions || []);
      setRecent(txRes.data.transactions || []);
      setPlaidConnected(statusRes.data.connected);
      setTransactionCount(statusRes.data.transactionCount ?? 0);
      setBudgets(budgetsRes.data);
      setGoals(goalsRes.data);
      setAlerts(alertsRes.data.alerts || []);
      setCompare(compareRes.data);
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

  const showPlaidCard = !plaidConnected || transactionCount === 0;

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

            {plaidConnected && !showPlaidCard && (
              <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                Bank connected. To reconnect or fix login errors, go to{" "}
                <Link href="/settings" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                  Settings
                </Link>
                .
              </p>
            )}

            {summary && cashFlow && (
              <div className="space-y-6">
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">Cash flow</h2>
                  <CashFlowCards cashFlow={cashFlow} />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    title="Spent this month"
                    value={`$${summary.totalSpentThisMonth.toFixed(2)}`}
                    hint={`All time: $${summary.totalSpent.toFixed(2)}`}
                  />
                  <StatCard
                    title="Income this month"
                    value={`$${summary.totalIncomeThisMonth.toFixed(2)}`}
                    hint={`All time: $${summary.totalIncome.toFixed(2)}`}
                  />
                  <StatCard title="Top category" value={summary.byCategory[0]?.category || "N/A"} />
                </div>

                {compare && <MonthCompareCard compare={compare} />}

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <SpendingChart />
                  </div>
                  <BudgetCard budgets={budgets} onUpdated={load} />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <RecurringCard subscriptions={recurring} />
                  <GoalsCard goals={goals} onUpdated={load} />
                </div>

                <AccountsCard data={accounts} onUpdated={load} />

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
