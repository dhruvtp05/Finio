export type SpendingGroupBy = "day" | "week" | "month" | "year";

export type SpendingTimelinePoint = {
  key: string;
  label: string;
  spent: number;
  income: number;
};

type TxnLike = { date: Date; amount: number };

const LIMITS: Record<SpendingGroupBy, number> = {
  day: 30,
  week: 12,
  month: 12,
  year: 5,
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function weekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekKey(date: Date) {
  return dayKey(weekStart(date));
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function yearKey(date: Date) {
  return String(date.getFullYear());
}

function bucketKey(date: Date, groupBy: SpendingGroupBy) {
  switch (groupBy) {
    case "day":
      return dayKey(date);
    case "week":
      return weekKey(date);
    case "month":
      return monthKey(date);
    case "year":
      return yearKey(date);
  }
}

function formatLabel(key: string, groupBy: SpendingGroupBy): string {
  switch (groupBy) {
    case "day": {
      const d = new Date(key + "T12:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    case "week": {
      const d = new Date(key + "T12:00:00");
      return `Wk ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    }
    case "month": {
      const [y, m] = key.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    case "year":
      return key;
  }
}

function fillEmptyBuckets(
  points: Map<string, { spent: number; income: number }>,
  groupBy: SpendingGroupBy,
  limit: number
): Map<string, { spent: number; income: number }> {
  const filled = new Map(points);
  const now = new Date();

  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date(now);
    if (groupBy === "day") d.setDate(d.getDate() - i);
    else if (groupBy === "week") d.setDate(d.getDate() - i * 7);
    else if (groupBy === "month") d.setMonth(d.getMonth() - i);
    else d.setFullYear(d.getFullYear() - i);

    const key = bucketKey(d, groupBy);
    if (!filled.has(key)) filled.set(key, { spent: 0, income: 0 });
  }

  return filled;
}

export function buildSpendingTimeline(
  txns: TxnLike[],
  groupBy: SpendingGroupBy,
  limit?: number
): SpendingTimelinePoint[] {
  const bucketLimit = limit ?? LIMITS[groupBy];
  const map = new Map<string, { spent: number; income: number }>();

  txns.forEach((txn) => {
    const key = bucketKey(new Date(txn.date), groupBy);
    const current = map.get(key) || { spent: 0, income: 0 };
    if (txn.amount > 0) current.spent += txn.amount;
    else current.income += Math.abs(txn.amount);
    map.set(key, current);
  });

  const filled = fillEmptyBuckets(map, groupBy, bucketLimit);

  return Array.from(filled.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-bucketLimit)
    .map(([key, totals]) => ({
      key,
      label: formatLabel(key, groupBy),
      spent: totals.spent,
      income: totals.income,
    }));
}

export function isValidGroupBy(value: string): value is SpendingGroupBy {
  return value === "day" || value === "week" || value === "month" || value === "year";
}
