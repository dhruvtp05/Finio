"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "@/components/Navbar";
import MonthCompareCard from "@/components/MonthCompareCard";
import RecurringCard from "@/components/RecurringCard";
import AccountsCard from "@/components/AccountsCard";
import api from "@/lib/api";
import {
  AccountsDto,
  BillCalendarItemDto,
  HeatmapDto,
  MerchantInsightDto,
  MonthCompareDto,
  RecurringDto,
  RunwayDto,
  WeeklyDigestDto,
} from "@/lib/types";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function InsightsClient() {
  const [digest, setDigest] = useState<WeeklyDigestDto | null>(null);
  const [compare, setCompare] = useState<MonthCompareDto | null>(null);
  const [recurring, setRecurring] = useState<RecurringDto["subscriptions"]>([]);
  const [accounts, setAccounts] = useState<AccountsDto | null>(null);
  const [merchants, setMerchants] = useState<MerchantInsightDto[]>([]);
  const [bills, setBills] = useState<BillCalendarItemDto[]>([]);
  const [runway, setRunway] = useState<RunwayDto | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDto | null>(null);
  const [cancelled, setCancelled] = useState<Set<string>>(new Set());
  const [year, setYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [digestRes, compareRes, recurringRes, accountsRes, billsRes, heatmapRes] = await Promise.all([
        api.get<WeeklyDigestDto>("/api/insights/weekly"),
        api.get<MonthCompareDto>("/api/transactions/compare"),
        api.get<RecurringDto>("/api/transactions/recurring"),
        api.get<AccountsDto>("/api/accounts"),
        api.get<{ bills: BillCalendarItemDto[] }>("/api/insights/bills?days=45"),
        api.get<HeatmapDto>("/api/insights/heatmap?days=90"),
      ]);
      setDigest(digestRes.data);
      setCompare(compareRes.data);
      setRecurring(recurringRes.data.subscriptions || []);
      setAccounts(accountsRes.data);
      setBills(billsRes.data.bills || []);
      setHeatmap(heatmapRes.data);
    } catch {
      toast.error("Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRunway = useCallback(async (keys: Set<string>) => {
    try {
      const params = keys.size ? `?cancelled=${Array.from(keys).join(",")}` : "";
      const res = await api.get<RunwayDto>(`/api/insights/runway${params}`);
      setRunway(res.data);
    } catch {
      toast.error("Failed to load runway");
    }
  }, []);

  const loadMerchants = useCallback(async () => {
    try {
      const params = new URLSearchParams({ year: String(year), limit: "20" });
      if (search.trim()) params.set("search", search.trim());
      const res = await api.get<{ merchants: MerchantInsightDto[] }>(`/api/insights/merchants?${params}`);
      setMerchants(res.data.merchants || []);
    } catch {
      toast.error("Failed to load merchants");
    }
  }, [year, search]);

  useEffect(() => {
    loadCore().catch(() => setLoading(false));
  }, [loadCore]);

  useEffect(() => {
    loadRunway(cancelled).catch(() => undefined);
  }, [cancelled, loadRunway]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadMerchants().catch(() => undefined);
    }, 200);
    return () => clearTimeout(t);
  }, [loadMerchants]);

  const toggleCancel = (key: string) => {
    setCancelled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportTax = async () => {
    try {
      const res = await api.get(`/api/transactions/tax-export?year=${taxYear}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `finio-tax-${taxYear}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Tax summary for ${taxYear} downloaded`);
    } catch {
      toast.error("Tax export failed");
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const fmtMonths = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)} mo`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Navbar />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Insights</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Digests, merchants, comparisons, and exports — kept off the main dashboard.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading insights...</p>
      ) : (
        <div className="space-y-8">
          {digest && (
            <section className="finio-card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Weekly digest</h2>
                <p className="text-xs text-slate-500">{digest.weekLabel}</p>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs uppercase text-slate-500">This week spent</p>
                  <p className="text-xl font-bold">{currency.format(digest.thisWeek.spent)}</p>
                  <p className="text-xs text-slate-400">
                    vs last week{" "}
                    <span className={digest.spentDelta <= 0 ? "text-emerald-600" : "text-red-600"}>
                      {digest.spentDelta > 0 ? "+" : ""}
                      {currency.format(digest.spentDelta)}
                      {digest.spentDeltaPercent !== null ? ` (${digest.spentDeltaPercent > 0 ? "+" : ""}${digest.spentDeltaPercent}%)` : ""}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs uppercase text-slate-500">This week income</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {currency.format(digest.thisWeek.income)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <p className="text-xs uppercase text-slate-500">Net</p>
                  <p className={`text-xl font-bold ${digest.thisWeek.net >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {currency.format(digest.thisWeek.net)}
                  </p>
                </div>
              </div>
              <ul className="mb-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {digest.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              {digest.topMerchants.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Top this week</p>
                  <ul className="space-y-1 text-sm">
                    {digest.topMerchants.map((m) => (
                      <li key={m.name} className="flex justify-between gap-2">
                        <span className="truncate">{m.name}</span>
                        <span className="shrink-0 font-medium">{currency.format(m.total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="finio-card">
              <h2 className="mb-1 text-lg font-semibold">Bill calendar</h2>
              <p className="mb-4 text-xs text-slate-500">Upcoming recurring charges (next 45 days)</p>
              {bills.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming bills detected.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto">
                  {bills.map((b) => (
                    <li
                      key={`${b.merchantKey}-${b.dueDate}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{b.merchantName}</p>
                        <p className="text-xs text-slate-500">
                          {b.category} · {b.cadence} · due {format(new Date(b.dueDate), "MMM d")}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium">{currency.format(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="finio-card">
              <h2 className="mb-1 text-lg font-semibold">Runway / what-if</h2>
              <p className="mb-4 text-xs text-slate-500">
                How long liquid assets last at your burn rate. Cancel subscriptions to project savings.
              </p>
              {runway ? (
                <>
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs uppercase text-slate-500">Liquid assets</p>
                      <p className="text-lg font-bold">{currency.format(runway.liquidAssets)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs uppercase text-slate-500">Current runway</p>
                      <p className="text-lg font-bold">{fmtMonths(runway.runwayMonths)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs uppercase text-slate-500">Monthly burn</p>
                      <p className="text-lg font-bold">{currency.format(runway.monthlyBurn)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs uppercase text-slate-500">Projected runway</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtMonths(runway.projectedRunwayMonths)}
                      </p>
                      {runway.cancelledMonthlySavings > 0 && (
                        <p className="text-xs text-slate-500">
                          Save {currency.format(runway.cancelledMonthlySavings)}/mo
                        </p>
                      )}
                    </div>
                  </div>
                  {runway.subscriptions.length === 0 ? (
                    <p className="text-sm text-slate-500">No subscriptions to cancel.</p>
                  ) : (
                    <ul className="max-h-56 space-y-2 overflow-y-auto">
                      {runway.subscriptions.map((s) => (
                        <li key={s.merchantKey} className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            id={`cancel-${s.merchantKey}`}
                            checked={cancelled.has(s.merchantKey)}
                            onChange={() => toggleCancel(s.merchantKey)}
                            className="rounded border-slate-300"
                          />
                          <label htmlFor={`cancel-${s.merchantKey}`} className="flex min-w-0 flex-1 justify-between gap-2">
                            <span className="truncate">{s.merchantName}</span>
                            <span className="shrink-0 text-slate-500">{currency.format(s.monthlyCost)}/mo</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">Loading runway...</p>
              )}
            </div>
          </section>

          {heatmap && (
            <section className="finio-card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Spending heatmap</h2>
                <p className="text-xs text-slate-500">Day-of-week spend and top merchants (last {heatmap.daysBack} days)</p>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={heatmap.byDayOfWeek}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(value) => [`$${Number(value).toFixed(2)}`, "Spent"]}
                      />
                      <Bar dataKey="spent" fill="#6366f1" radius={[6, 6, 0, 0]} name="Spent" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Top merchants</p>
                  {heatmap.byMerchant.length === 0 ? (
                    <p className="text-sm text-slate-500">No merchant spend in this window.</p>
                  ) : (
                    <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                      {heatmap.byMerchant.slice(0, 12).map((m) => (
                        <li key={m.merchant} className="flex justify-between gap-2">
                          <span className="truncate">{m.merchant}</span>
                          <span className="shrink-0 font-medium">{currency.format(m.spent)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="finio-card">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Merchant insights</h2>
                  <p className="text-xs text-slate-500">Where your money went this year</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select className="finio-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <input
                    className="finio-input w-40"
                    placeholder="Search merchant"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {merchants.length === 0 ? (
                <p className="text-sm text-slate-500">No merchant spend for this filter.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto">
                  {merchants.map((m) => (
                    <li
                      key={m.merchantKey}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          You spent {currency.format(m.total)} at {m.merchantName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {m.category} · {m.count} txn{m.count === 1 ? "" : "s"} · last{" "}
                          {format(new Date(m.lastDate), "MMM d")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="finio-card">
              <h2 className="mb-1 text-lg font-semibold">Tax / year-end export</h2>
              <p className="mb-4 text-xs text-slate-500">
                Category totals for a tax year (excludes transfers). CSV for spreadsheets.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Tax year</label>
                  <select className="finio-input" value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))}>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={exportTax} className="finio-btn-primary">
                  Download CSV
                </button>
              </div>
            </div>
          </section>

          {compare && <MonthCompareCard compare={compare} />}

          <section className="grid gap-6 lg:grid-cols-2">
            <RecurringCard subscriptions={recurring} />
            <AccountsCard data={accounts} onUpdated={loadCore} />
          </section>
        </div>
      )}
    </div>
  );
}
