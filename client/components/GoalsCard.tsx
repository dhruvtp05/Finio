"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import api from "@/lib/api";
import { GoalDto } from "@/lib/types";

function progressColor(pct: number) {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75) return "bg-indigo-500";
  return "bg-indigo-400";
}

export default function GoalsCard({ goals, onUpdated }: { goals: GoalDto[]; onUpdated: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contribAmounts, setContribAmounts] = useState<Record<string, string>>({});
  const [savingContrib, setSavingContrib] = useState<string | null>(null);

  const addGoal = async () => {
    try {
      await api.post("/api/goals", {
        title,
        targetAmount: Number(targetAmount),
        deadline: new Date(deadline).toISOString(),
      });
      toast.success("Goal created");
      setAdding(false);
      setTitle("");
      setTargetAmount("");
      setDeadline("");
      onUpdated();
    } catch {
      toast.error("Failed to create goal");
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await api.delete(`/api/goals/${id}`);
      toast.success("Goal removed");
      onUpdated();
    } catch {
      toast.error("Failed to delete goal");
    }
  };

  const addContribution = async (goalId: string) => {
    const raw = contribAmounts[goalId];
    const amount = Number(raw);
    if (!(amount > 0)) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    setSavingContrib(goalId);
    try {
      await api.post(`/api/goals/${goalId}/contributions`, { amount });
      toast.success("Contribution added");
      setContribAmounts((prev) => ({ ...prev, [goalId]: "" }));
      onUpdated();
    } catch {
      toast.error("Failed to add contribution");
    } finally {
      setSavingContrib(null);
    }
  };

  return (
    <div className="finio-card h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Savings goals</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Progress from income minus spending since the goal was set.</p>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>

      {adding && (
        <div className="mb-4 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <input className="finio-input w-full" placeholder="e.g. Save for vacation" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="finio-input w-full" placeholder="Target amount" type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} />
          <input className="finio-input w-full" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <button type="button" onClick={addGoal} className="finio-btn-primary w-full" disabled={!title || !targetAmount || !deadline}>
            Save goal
          </button>
        </div>
      )}

      <div className="space-y-4">
        {goals.map((goal) => {
          const pct = Math.min(goal.progressPercent, 100);
          return (
            <div key={goal._id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-100">{goal.title}</span>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span>
                    ${goal.saved.toFixed(0)} / ${goal.targetAmount}
                  </span>
                  <button type="button" onClick={() => deleteGoal(goal._id)} className="text-xs text-red-500">
                    ×
                  </button>
                </div>
              </div>
              <div className="mb-1 h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={`h-2.5 rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-slate-400">
                Due {format(new Date(goal.deadline), "MMM d, yyyy")}
                {goal.completed ? " · Completed" : ` · ${pct.toFixed(0)}%`}
              </p>
              {(goal.fromCashFlow !== undefined || goal.fromContributions !== undefined) && (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {goal.fromCashFlow !== undefined && (
                    <span>Cash flow ${goal.fromCashFlow.toFixed(0)}</span>
                  )}
                  {goal.fromCashFlow !== undefined && goal.fromContributions !== undefined && " · "}
                  {goal.fromContributions !== undefined && (
                    <span>Contributions ${goal.fromContributions.toFixed(0)}</span>
                  )}
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  className="finio-input w-28"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={contribAmounts[goal._id] || ""}
                  onChange={(e) =>
                    setContribAmounts((prev) => ({ ...prev, [goal._id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="finio-btn-secondary text-xs"
                  disabled={savingContrib === goal._id}
                  onClick={() => addContribution(goal._id)}
                >
                  {savingContrib === goal._id ? "..." : "Contribute"}
                </button>
              </div>
            </div>
          );
        })}
        {!goals.length && <p className="text-sm text-slate-500 dark:text-slate-400">No goals yet — set a target and track savings automatically.</p>}
      </div>
    </div>
  );
}
