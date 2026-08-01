import { ITransactionDocument } from "../models/Transaction";

export type RecurringCadence = "monthly" | "weekly" | "annual";

export interface RecurringSubscription {
  merchantKey: string;
  merchantName: string;
  category: string;
  avgAmount: number;
  cadence: RecurringCadence;
  occurrenceCount: number;
  lastDate: string;
  monthsActive: number;
  yearlyCost: number;
  nextExpectedDate: string | null;
}

const CORP_SUFFIXES = /\b(inc|llc|ltd|corp|co|company|plc)\b\.?/gi;
const NOISE = /[^a-z0-9\s]/g;

/** Normalize for fuzzy grouping: lowercase, strip corp noise, collapse spaces */
export function normalizeMerchantKey(txn: { merchantName?: string; name?: string }): string {
  const raw = (txn.merchantName || txn.name || "").trim().toLowerCase();
  return raw
    .replace(CORP_SUFFIXES, " ")
    .replace(/\s+#?\d+$/, "")
    .replace(NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(key: string): Set<string> {
  return new Set(key.split(" ").filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Merge near-duplicate merchant keys (e.g. "netflix" / "netflix com") */
function clusterMerchantKeys(keys: string[]): Map<string, string> {
  const sorted = [...keys].sort((a, b) => a.length - b.length);
  const canonical = new Map<string, string>();
  const reps: string[] = [];

  for (const key of sorted) {
    const tokens = tokenize(key);
    let matched: string | null = null;
    for (const rep of reps) {
      if (key.includes(rep) || rep.includes(key)) {
        matched = rep;
        break;
      }
      if (jaccard(tokens, tokenize(rep)) >= 0.6) {
        matched = rep;
        break;
      }
    }
    if (matched) {
      canonical.set(key, matched);
    } else {
      reps.push(key);
      canonical.set(key, key);
    }
  }
  return canonical;
}

function amountsSimilar(amounts: number[]): boolean {
  if (amounts.length < 2) return true;
  const median = amounts.slice().sort((a, b) => a - b)[Math.floor(amounts.length / 2)];
  const tolerance = Math.max(median * 0.25, 5);
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

function sameMonthAcrossYears(dates: Date[]): boolean {
  if (dates.length < 2) return false;
  const years = new Set(dates.map((d) => d.getFullYear()));
  if (years.size < 2) return false;
  const months = new Set(dates.map((d) => d.getMonth()));
  return months.size === 1;
}

function detectCadence(dates: Date[], monthsActive: number, count: number): RecurringCadence | null {
  const gap = medianGapDays(dates);
  if (gap === null) return null;

  if (gap >= 25 && gap <= 38) return "monthly";
  if (gap >= 6 && gap <= 9) return "weekly";
  if (gap >= 20 && gap <= 45 && monthsActive >= 2) return "monthly";
  if ((gap >= 300 && gap <= 400) || sameMonthAcrossYears(dates)) return "annual";
  if (count >= 2 && monthsActive >= 2 && gap >= 80 && gap <= 100) return "monthly"; // ~quarterly treated poorly; skip
  return null;
}

function yearlyFromCadence(avg: number, cadence: RecurringCadence): number {
  if (cadence === "weekly") return Math.round(avg * 52 * 100) / 100;
  if (cadence === "monthly") return Math.round(avg * 12 * 100) / 100;
  return Math.round(avg * 100) / 100;
}

function nextExpected(last: Date, cadence: RecurringCadence): Date {
  const d = new Date(last);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else if (cadence === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

export function detectRecurringSubscriptions(
  txns: ITransactionDocument[],
  effectiveCategory: (txn: ITransactionDocument) => string
): RecurringSubscription[] {
  const rawGroups = new Map<string, ITransactionDocument[]>();

  txns.forEach((txn) => {
    if (txn.pending || txn.excludedFromTotals || txn.isCreditCardPayment) return;
    const cat = effectiveCategory(txn);
    if (cat === "Income" || cat === "Transfers") return;
    // Keep charges and refunds so we can drop net-zero sandbox pairs (e.g. United +/- $500)
    const key = normalizeMerchantKey(txn);
    if (!key || key.length < 2) return;
    const list = rawGroups.get(key) || [];
    list.push(txn);
    rawGroups.set(key, list);
  });

  const keyMap = clusterMerchantKeys([...rawGroups.keys()]);
  const byMerchant = new Map<string, ITransactionDocument[]>();

  rawGroups.forEach((list, key) => {
    const canon = keyMap.get(key) || key;
    const existing = byMerchant.get(canon) || [];
    existing.push(...list);
    byMerchant.set(canon, existing);
  });

  const results: RecurringSubscription[] = [];

  byMerchant.forEach((group, merchantKey) => {
    const charges = group.filter((t) => t.amount > 0);
    const net = group.reduce((s, t) => s + t.amount, 0);
    // Refunds cancel the charges → not a real subscription
    if (charges.length < 2 || net <= 0) return;

    const amounts = charges.map((t) => t.amount);
    if (!amountsSimilar(amounts)) return;

    const dates = charges.map((t) => new Date(t.date));
    const monthsActive = distinctMonths(dates);

    const cadence = detectCadence(dates, monthsActive, charges.length);
    if (!cadence) return;

    // Annual can have 2 charges across years; monthly/weekly need 2+ months
    if (cadence !== "annual" && monthsActive < 2) return;

    const sorted = [...charges].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const displayName = sorted[0].merchantName || sorted[0].name || merchantKey;
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const avg = Math.round(avgAmount * 100) / 100;
    const last = new Date(sorted[0].date);

    results.push({
      merchantKey,
      merchantName: displayName,
      category: effectiveCategory(sorted[0]),
      avgAmount: avg,
      cadence,
      occurrenceCount: charges.length,
      lastDate: last.toISOString(),
      monthsActive,
      yearlyCost: yearlyFromCadence(avg, cadence),
      nextExpectedDate: nextExpected(last, cadence).toISOString(),
    });
  });

  return results.sort((a, b) => b.yearlyCost - a.yearlyCost);
}
