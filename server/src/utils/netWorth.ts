/** Classify Plaid account types into assets vs liabilities for net worth */
export function accountContribution(type: string, currentBalance: number): {
  assets: number;
  liabilities: number;
  net: number;
} {
  const t = type.toLowerCase();
  // Credit and loan balances are typically positive amounts owed
  if (t === "credit" || t === "loan") {
    return { assets: 0, liabilities: Math.abs(currentBalance), net: -Math.abs(currentBalance) };
  }
  // Investment / depository / brokerage: positive = asset
  return { assets: currentBalance, liabilities: 0, net: currentBalance };
}

export function computeNetWorthFromAccounts(
  accounts: Array<{ type: string; currentBalance: number }>
): { netWorth: number; assets: number; liabilities: number } {
  let assets = 0;
  let liabilities = 0;
  accounts.forEach((a) => {
    const c = accountContribution(a.type, a.currentBalance);
    assets += c.assets;
    liabilities += c.liabilities;
  });
  return {
    assets: Math.round(assets * 100) / 100,
    liabilities: Math.round(liabilities * 100) / 100,
    netWorth: Math.round((assets - liabilities) * 100) / 100,
  };
}
