/** Classify a transaction for spend / income math (Plaid: +out, −in). */

export type MoneyKind = "spend" | "income" | "refund" | "skip";

export interface MoneyTxn {
  amount: number;
  /** Effective Finio category */
  category?: string;
  isCreditCardPayment?: boolean;
  excludedFromTotals?: boolean;
}

export function classifyMoney(txn: MoneyTxn): { kind: MoneyKind; amount: number } {
  if (txn.excludedFromTotals) return { kind: "skip", amount: 0 };

  const cat = txn.category || "";
  const abs = Math.abs(txn.amount);

  if (txn.isCreditCardPayment || cat === "Transfers") {
    return { kind: "skip", amount: 0 };
  }

  if (txn.amount > 0) {
    // Positive "Income" is mislabeled — do not treat as a charge
    if (cat === "Income") return { kind: "skip", amount: 0 };
    return { kind: "spend", amount: abs };
  }

  if (txn.amount < 0) {
    // Only real income categories count as income. Travel/Shopping refunds are refunds.
    if (cat === "Income") return { kind: "income", amount: abs };
    return { kind: "refund", amount: abs };
  }

  return { kind: "skip", amount: 0 };
}

export function applyMoney(
  txn: MoneyTxn,
  acc: { spent: number; income: number },
  onSpendCategory?: (category: string, signedDelta: number) => void
) {
  const { kind, amount } = classifyMoney(txn);
  if (kind === "spend") {
    acc.spent += amount;
    if (txn.category && onSpendCategory) onSpendCategory(txn.category, amount);
  } else if (kind === "income") {
    acc.income += amount;
  } else if (kind === "refund") {
    acc.spent -= amount;
    if (txn.category && onSpendCategory) onSpendCategory(txn.category, -amount);
  }
}

export function isExpenseCharge(txn: MoneyTxn): boolean {
  return classifyMoney(txn).kind === "spend";
}
