"use client";

import { useState } from "react";
import api from "@/lib/api";
import { BudgetDto } from "@/lib/types";
import { FINIO_CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";

function progressColor(pct: number) {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-indigo-500";
}

export default function BudgetCard({
  budgets,
  onUpdated,
}: {
  budgets: BudgetDto[];
  onUpdated: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLimit, setDraftLimit] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftRollover, setDraftRollover] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCategory, setNewCategory] = useState(FINIO_CATEGORIES[0]);
  const [newLabel, setNewLabel] = useState("");
  const [newLimit, setNewLimit] = useState("");

  const usedCategories = new Set(budgets.map((b) => b.category));
  const availableCategories = FINIO_CATEGORIES.filter((c) => c !== "Income" && c !== "Transfers");

  const startEdit = (budget: BudgetDto) => {
    setEditingId(budget._id);
    setDraftLimit(String(budget.limit));
    setDraftLabel(budget.label);
    setDraftRollover(budget.rolloverEnabled !== false);
  };

  const saveEdit = async (id: string) => {
    try {
      await api.put(`/api/budgets/${id}`, {
        label: draftLabel,
        limit: Number(draftLimit),
        rolloverEnabled: draftRollover,
      });
      toast.success("Budget updated");
      setEditingId(null);
      onUpdated();
    } catch {
      toast.error("Failed to update budget");
    }
  };

  const addBudget = async () => {
    try {
      await api.post("/api/budgets", {
        category: newCategory,
        label: newLabel || newCategory,
        limit: Number(newLimit),
        rolloverEnabled: true,
      });
      toast.success("Budget added");
      setAdding(false);
      setNewCategory(FINIO_CATEGORIES[0]);
      setNewLabel("");
      setNewLimit("");
      onUpdated();
    } catch {
      toast.error("Failed to add budget");
    }
  };

  const deleteBudget = async (id: string) => {
    try {
      await api.delete(`/api/budgets/${id}`);
      toast.success("Budget removed");
      onUpdated();
    } catch {
      toast.error("Failed to delete budget");
    }
  };

  return (
    <div className="finio-card h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Budgets</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Unused amount can roll into next month</p>
        </div>
        <button type="button" onClick={() => setAdding((v) => !v)} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          {adding ? "Cancel" : "+ Add"}
        </button>
      </div>

      {adding && (
        <div className="mb-4 space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <select
            className="finio-input w-full"
            value={newCategory}
            onChange={(e) => {
              setNewCategory(e.target.value as typeof newCategory);
              if (!newLabel) setNewLabel(e.target.value);
            }}
          >
            {availableCategories.map((cat) => (
              <option key={cat} value={cat} disabled={usedCategories.has(cat)}>
                {cat}
                {usedCategories.has(cat) ? " (already tracked)" : ""}
              </option>
            ))}
          </select>
          <input className="finio-input w-full" placeholder="Display label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <input className="finio-input w-full" placeholder="Monthly limit" type="number" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} />
          <button type="button" onClick={addBudget} className="finio-btn-primary w-full">
            Save budget
          </button>
        </div>
      )}

      <div className="space-y-4">
        {budgets.map((budget) => {
          const cap = budget.effectiveLimit ?? budget.limit;
          const pct = cap > 0 ? Math.min((budget.spent / cap) * 100, 100) : 0;
          const isEditing = editingId === budget._id;
          const rollover = budget.rolloverAmount || 0;

          return (
            <div key={budget._id}>
              {isEditing ? (
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <input className="finio-input w-full" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} />
                  <input className="finio-input w-full" type="number" value={draftLimit} onChange={(e) => setDraftLimit(e.target.value)} />
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={draftRollover} onChange={(e) => setDraftRollover(e.target.checked)} />
                    Roll over unused budget
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => saveEdit(budget._id)} className="finio-btn-primary flex-1">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="finio-btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <button type="button" onClick={() => startEdit(budget)} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                      {budget.label}
                    </button>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span>
                        ${budget.spent.toFixed(0)} / ${cap.toFixed(0)}
                      </span>
                      <button type="button" onClick={() => deleteBudget(budget._id)} className="text-xs text-red-500">
                        ×
                      </button>
                    </div>
                  </div>
                  {rollover > 0 && (
                    <p className="mb-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      +${rollover.toFixed(0)} rolled over from last month
                    </p>
                  )}
                  <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={`h-2.5 rounded-full transition-all ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
        {!budgets.length && <p className="text-sm text-slate-500">No budgets yet — add one to track spending.</p>}
      </div>
    </div>
  );
}
