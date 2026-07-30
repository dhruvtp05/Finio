import { isFinioCategory } from "../services/categorization";

export interface RuleLike {
  pattern: string;
  match: "contains" | "exact";
  category: string;
  enabled?: boolean;
}

export function matchCategoryRule(
  merchantName: string | undefined,
  name: string | undefined,
  rules: RuleLike[]
): string | undefined {
  const hay = `${merchantName || ""} ${name || ""}`.trim().toLowerCase();
  if (!hay) return undefined;

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    if (!isFinioCategory(rule.category)) continue;
    const pat = rule.pattern.trim().toLowerCase();
    if (!pat) continue;
    if (rule.match === "exact") {
      const m = (merchantName || name || "").trim().toLowerCase();
      if (m === pat) return rule.category;
    } else if (hay.includes(pat)) {
      return rule.category;
    }
  }
  return undefined;
}

const CC_PAYMENT_RE =
  /\b(credit\s*card\s*payment|card\s*payment|payment\s*thank\s*you|autopay|auto[\s-]?pay|online\s*payment|payment\s*to\s*chase|payment\s*to\s*amex|payment\s*to\s*capital\s*one|cc\s*payment)\b/i;

export function looksLikeCreditCardPayment(txn: {
  name?: string;
  merchantName?: string;
  category?: string[];
  suggestedCategory?: string;
  userCategory?: string;
  amount: number;
}): boolean {
  if (txn.amount <= 0) return false;
  const text = `${txn.merchantName || ""} ${txn.name || ""} ${(txn.category || []).join(" ")}`;
  if (CC_PAYMENT_RE.test(text)) return true;
  const cat = (txn.userCategory || txn.suggestedCategory || "").toLowerCase();
  if (cat === "transfers" && /\bpayment\b/i.test(text)) return true;
  const plaid = (txn.category || []).join(" ").toLowerCase();
  if (plaid.includes("credit card") && plaid.includes("payment")) return true;
  return false;
}

/** Skip from spend metrics: transfers, CC payments, income category */
export function shouldExcludeFromSpend(txn: {
  amount: number;
  category?: string;
  isCreditCardPayment?: boolean;
}): boolean {
  if (txn.isCreditCardPayment) return true;
  if (txn.category === "Transfers" || txn.category === "Income") return true;
  return false;
}
