"use client";

import { format } from "date-fns";
import { AccountsDto } from "@/lib/types";
import api from "@/lib/api";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function AccountsCard({
  data,
  onUpdated,
}: {
  data: AccountsDto | null;
  onUpdated: () => void;
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
          <h3 className="text-lg font-semibold">Accounts & net worth</h3>
          <button type="button" onClick={sync} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            Sync balances
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          After connecting Plaid, account balances appear here for a live net-worth view.
        </p>
      </div>
    );
  }

  return (
    <div className="finio-card h-full">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Accounts & net worth</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">From linked Plaid balances</p>
        </div>
        <button type="button" onClick={sync} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Refresh
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
          <p className="text-[10px] uppercase text-slate-500">Assets</p>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{currency.format(data.assets)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
          <p className="text-[10px] uppercase text-slate-500">Liabilities</p>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">{currency.format(data.liabilities)}</p>
        </div>
        <div className="rounded-xl bg-indigo-50 p-2 dark:bg-indigo-950/40">
          <p className="text-[10px] uppercase text-indigo-600 dark:text-indigo-300">Net worth</p>
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{currency.format(data.netWorth)}</p>
        </div>
      </div>

      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {data.accounts.map((acct) => (
          <li
            key={acct._id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{acct.name}{acct.mask ? ` ···${acct.mask}` : ""}</p>
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

      {data.history.length > 1 && (
        <p className="mt-3 text-xs text-slate-400">
          Snapshot history: {data.history.length} days · latest{" "}
          {format(new Date(data.history[data.history.length - 1].date), "MMM d")}
        </p>
      )}
    </div>
  );
}
