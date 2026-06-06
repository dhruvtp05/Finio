import { ITransactionDocument } from "../models/Transaction";

export interface RecurringSubscription {
  merchantKey: string;
  merchantName: string;
  category: string;
  avgAmount: number;
  cadence: "monthly" | "weekly";
  occurrenceCount: number;
  lastDate: string;
  monthsActive: number;
}

function normalizeMerchant(txn: ITransactionDocument): string {
  const raw = (txn.merchantName || txn.name || "").trim().toLowerCase();
  return raw.replace(/\s+#?\d+$/, "").replace(/\s+/g, " ");
}

function amountsSimilar(amounts: number[]): boolean {
  if (amounts.length < 2) return true;
  const median = amounts.slice().sort((a, b) => a - b)[Math.floor(amounts.length / 2)];
  const tolerance = Math.max(median * 0.2, 3);
  return amounts.every((a) => Math.abs(a - median) <= tolerance);
}

function medianGapDays(dates: Date[]): number | null {
  if (dates.length < 2) return null;
  const sorted = dates.map((d) => d.getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24));
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function distinctMonths(dates: Date[]): number {
  const keys = new Set(dates.map((d) => `${d.getFullYear()}-${d.getMonth()}`));
  return keys.size;
}

export function detectRecurringSubscriptions(
  txns: ITransactionDocument[],
  effectiveCategory: (txn: ITransactionDocument) => string
): RecurringSubscription[] {
  const byMerchant = new Map<string, ITransactionDocument[]>();

  txns.forEach((txn) => {
    if (txn.amount <= 0 || txn.pending) return;
    const key = normalizeMerchant(txn);
    if (!key || key.length < 2) return;
    const list = byMerchant.get(key) || [];
    list.push(txn);
    byMerchant.set(key, list);
  });

  const results: RecurringSubscription[] = [];

  byMerchant.forEach((group, merchantKey) => {
    if (group.length < 2) return;

    const amounts = group.map((t) => t.amount);
    if (!amountsSimilar(amounts)) return;

    const dates = group.map((t) => new Date(t.date));
    const monthsActive = distinctMonths(dates);
    if (monthsActive < 2) return;

    const gap = medianGapDays(dates);
    if (gap === null) return;

    let cadence: "monthly" | "weekly" | null = null;
    if (gap >= 25 && gap <= 38) cadence = "monthly";
    else if (gap >= 6 && gap <= 9) cadence = "weekly";
    else if (monthsActive >= 2 && group.length >= 2 && gap >= 20 && gap <= 45) cadence = "monthly";
    else return;

    const sorted = [...group].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const displayName = sorted[0].merchantName || sorted[0].name || merchantKey;
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;

    results.push({
      merchantKey,
      merchantName: displayName,
      category: effectiveCategory(sorted[0]),
      avgAmount: Math.round(avgAmount * 100) / 100,
      cadence,
      occurrenceCount: group.length,
      lastDate: new Date(sorted[0].date).toISOString(),
      monthsActive,
    });
  });

  return results.sort((a, b) => b.avgAmount - a.avgAmount);
}
