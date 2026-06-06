"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "@/lib/api";
import { SpendingGroupBy, SpendingTimelineDto } from "@/lib/types";

const VIEWS: Array<{ id: SpendingGroupBy; label: string; description: string }> = [
  { id: "day", label: "Daily", description: "Last 30 days" },
  { id: "week", label: "Weekly", description: "Last 12 weeks" },
  { id: "month", label: "Monthly", description: "Last 12 months" },
  { id: "year", label: "Yearly", description: "Last 5 years" },
];

const LIMITS: Record<SpendingGroupBy, number> = {
  day: 30,
  week: 12,
  month: 12,
  year: 5,
};

export default function SpendingChart() {
  const [groupBy, setGroupBy] = useState<SpendingGroupBy>("month");
  const [data, setData] = useState<SpendingTimelineDto["data"]>([]);
  const [loading, setLoading] = useState(true);
  const [showIncome, setShowIncome] = useState(false);

  const load = useCallback(async (view: SpendingGroupBy) => {
    setLoading(true);
    try {
      const res = await api.get<SpendingTimelineDto>(
        `/api/transactions/spending-timeline?groupBy=${view}&limit=${LIMITS[view]}`
      );
      setData(res.data.data);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(groupBy).catch(() => setLoading(false));
  }, [groupBy, load]);

  const hasData = data.some((d) => d.spent > 0 || d.income > 0);
  const activeView = VIEWS.find((v) => v.id === groupBy);

  return (
    <div className="finio-card h-full">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold dark:text-slate-100">Spending overview</h3>
          {activeView && <p className="text-xs text-slate-500 dark:text-slate-400">{activeView.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => setGroupBy(view.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                groupBy === view.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
        <input type="checkbox" checked={showIncome} onChange={(e) => setShowIncome(e.target.checked)} />
        Show income bars
      </label>

      {loading ? (
        <div className="flex h-72 items-center justify-center text-sm text-slate-500">Loading chart...</div>
      ) : !hasData ? (
        <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/30 dark:text-slate-400">
          Connect Plaid to see your spending trend
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ bottom: groupBy === "day" ? 8 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: groupBy === "day" ? 10 : 11 }}
                interval={groupBy === "day" ? "preserveStartEnd" : 0}
                angle={groupBy === "day" ? -35 : 0}
                textAnchor={groupBy === "day" ? "end" : "middle"}
                height={groupBy === "day" ? 50 : 30}
              />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name === "spent" ? "Spent" : "Income"]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as { key?: string; label?: string } | undefined;
                  return point?.key || point?.label || "";
                }}
              />
              {showIncome && <Legend />}
              <Bar dataKey="spent" fill="#6366f1" radius={[6, 6, 0, 0]} name="Spent" />
              {showIncome && <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="Income" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
