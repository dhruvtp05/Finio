"use client";

const BUDGETS = [
  { key: "Food and Drink", label: "Food", limit: 500 },
  { key: "Transportation", label: "Transport", limit: 200 },
  { key: "Entertainment", label: "Entertainment", limit: 150 },
];

export default function BudgetCard({ byCategory }: { byCategory: Array<{ category: string; total: number }> }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">Budgets</h3>
      <div className="space-y-4">
        {BUDGETS.map((budget) => {
          const spent = byCategory.find((item) => item.category === budget.key)?.total ?? 0;
          const progress = Math.min((spent / budget.limit) * 100, 100);
          return (
            <div key={budget.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{budget.label}</span>
                <span>
                  ${spent.toFixed(0)} / ${budget.limit}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
