"use client";

import { format } from "date-fns";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AccountsDto } from "@/lib/types";
import api from "@/lib/api";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function AccountsCard({
  data,
  onUpdated,
  compact = false,
}: {
  data: AccountsDto | null;
  onUpdated: () => void;
  /** Compact: chart + totals only (for dashboard) */
  compact?: boolean;
}) {
  const sync = async () => {
    try {
      await api.post("/api/accounts/sync");
      toast.success("Balances refreshed");
      onUpdated();
    } catch {
      toast.error("Could not sync balances — connect Plaid first");
    }
  };

  if (!data || data.accounts.length === 0) {
    return (
      <div className="finio-card h-full">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Net worth</h3>
          <button type="button" onClick={sync} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            Sync
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Connect Plaid to track balances and net worth over time.
        </p>
      </div>
    );
  }

  const chartData = data.history.map((h) => ({
    date: format(new Date(h.date), "MMM d"),
    netWorth: h.netWorth,
  }));

  return (
    <div className="finio-card h-full">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Net worth</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {currency.format(data.netWorth)} · assets {currency.format(data.assets)} · debt {currency.format(data.liabilities)}
          </p>
        </div>
        <button type="button" onClick={sync} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Refresh
        </button>
      </div>

      {chartData.length > 1 ? (
        <div className={compact ? "mb-2 h-36" : "mb-4 h-44"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number | string) => [currency.format(Number(v)), "Net worth"]} />
              <Area type="monotone" dataKey="netWorth" stroke="#6366f1" fill="url(#nwFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mb-3 text-xs text-slate-400">Sync a few times to build a net-worth trend.</p>
      )}

      {!compact && (
        <ul className="max-h-48 space-y-2 overflow-y-auto">
          {data.accounts.map((acct) => (
            <li
              key={acct._id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {acct.name}
                  {acct.mask ? ` ···${acct.mask}` : ""}
                </p>
                <p className="text-xs capitalize text-slate-500">
                  {acct.type}
                  {acct.subtype ? ` · ${acct.subtype}` : ""}
                </p>
              </div>
              <p className={`shrink-0 font-semibold ${acct.contribution < 0 ? "text-red-600" : "text-slate-800 dark:text-slate-100"}`}>
                {currency.format(acct.currentBalance)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
