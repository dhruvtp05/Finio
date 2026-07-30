import { Types } from "mongoose";
import Account from "../models/Account";
import CategoryRule from "../models/CategoryRule";
import NetWorthSnapshot from "../models/NetWorthSnapshot";
import Transaction from "../models/Transaction";
import User, { IUserDocument } from "../models/User";
import { decryptSecret, encryptSecret } from "../utils/crypto";
import { computeNetWorthFromAccounts } from "../utils/netWorth";
import { looksLikeCreditCardPayment, matchCategoryRule } from "../utils/rules";
import { normalizeToFinioCategory } from "./categorization";
import { getPlaidClient } from "./plaidClient";

type PlaidTxn = {
  transaction_id: string;
  name: string;
  amount: number;
  category?: string[] | null;
  date: string;
  merchant_name?: string | null;
  pending?: boolean | null;
};

export function getUserAccessToken(user: IUserDocument): string | null {
  if (user.plaidAccessTokenEnc) {
    return decryptSecret(user.plaidAccessTokenEnc);
  }
  if (user.plaidAccessToken) {
    return user.plaidAccessToken;
  }
  return null;
}

export async function setUserAccessToken(user: IUserDocument, accessToken: string) {
  user.plaidAccessTokenEnc = encryptSecret(accessToken);
  user.plaidAccessToken = undefined;
  await user.save();
}

function txnToUpsert(userId: Types.ObjectId, txn: PlaidTxn) {
  const suggestedCategory = normalizeToFinioCategory(txn.merchant_name, txn.name, txn.category || undefined);
  const isCreditCardPayment = looksLikeCreditCardPayment({
    name: txn.name,
    merchantName: txn.merchant_name || undefined,
    category: txn.category || undefined,
    suggestedCategory,
    amount: txn.amount,
  });
  return {
    updateOne: {
      filter: { plaidTransactionId: txn.transaction_id },
      update: {
        $set: {
          userId,
          plaidTransactionId: txn.transaction_id,
          name: txn.name,
          amount: txn.amount,
          category: txn.category || [],
          suggestedCategory,
          date: new Date(txn.date),
          merchantName: txn.merchant_name ?? undefined,
          pending: txn.pending ?? undefined,
          source: "plaid",
          isCreditCardPayment,
        },
        $setOnInsert: {
          categoryLocked: false,
          excludedFromTotals: false,
          tags: [],
        },
      },
      upsert: true,
    },
  };
}

/** Apply user category rules to unlocked transactions */
export async function applyRulesToUser(userId: Types.ObjectId): Promise<number> {
  const rules = await CategoryRule.find({ userId, enabled: true });
  if (!rules.length) return 0;

  const txns = await Transaction.find({
    userId,
    excludedFromTotals: { $ne: true },
    $or: [{ categoryLocked: { $ne: true } }, { categoryLocked: { $exists: false } }],
  });

  const ops = [];
  for (const t of txns) {
    const cat = matchCategoryRule(t.merchantName, t.name, rules);
    if (!cat || t.userCategory === cat) continue;
    ops.push({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { userCategory: cat, categoryLocked: true } },
      },
    });
  }
  if (ops.length) await Transaction.bulkWrite(ops as Parameters<typeof Transaction.bulkWrite>[0]);
  return ops.length;
}

export async function syncUserAccounts(user: IUserDocument): Promise<number> {
  const accessToken = getUserAccessToken(user);
  if (!accessToken) {
    throw new Error("No connected Plaid account");
  }

  const res = await getPlaidClient().accountsGet({ access_token: accessToken });
  const now = new Date();
  const ops = res.data.accounts.map((acct) => ({
    updateOne: {
      filter: { userId: user._id, plaidAccountId: acct.account_id },
      update: {
        $set: {
          userId: user._id,
          plaidAccountId: acct.account_id,
          name: acct.name,
          officialName: acct.official_name ?? undefined,
          type: acct.type,
          subtype: acct.subtype ?? undefined,
          mask: acct.mask ?? undefined,
          currentBalance: acct.balances.current ?? 0,
          availableBalance: acct.balances.available ?? undefined,
          isoCurrencyCode: acct.balances.iso_currency_code ?? "USD",
          lastSyncedAt: now,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length) {
    await Account.bulkWrite(ops as Parameters<typeof Account.bulkWrite>[0]);
  }

  const accounts = await Account.find({ userId: user._id });
  const { netWorth, assets, liabilities } = computeNetWorthFromAccounts(accounts);
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  await NetWorthSnapshot.findOneAndUpdate(
    { userId: user._id, date: day },
    { $set: { netWorth, assets, liabilities, date: day, userId: user._id } },
    { upsert: true }
  );

  return ops.length;
}

export async function syncUserTransactions(user: IUserDocument): Promise<number> {
  const accessToken = getUserAccessToken(user);
  if (!accessToken) {
    throw new Error("No connected Plaid account");
  }

  if (user.plaidAccessToken && !user.plaidAccessTokenEnc) {
    await setUserAccessToken(user, user.plaidAccessToken);
  }

  const collected: PlaidTxn[] = [];
  const modified: PlaidTxn[] = [];
  const removedIds: string[] = [];

  let cursor = user.plaidSyncCursor || undefined;
  let hasMore = true;

  while (hasMore) {
    const syncRes = await getPlaidClient().transactionsSync({
      access_token: accessToken,
      ...(cursor ? { cursor } : {}),
    });
    collected.push(...syncRes.data.added);
    modified.push(...syncRes.data.modified);
    removedIds.push(
      ...syncRes.data.removed
        .map((r) => r.transaction_id)
        .filter((id): id is string => typeof id === "string")
    );
    cursor = syncRes.data.next_cursor;
    hasMore = syncRes.data.has_more;
  }

  if (!collected.length && !modified.length && !user.plaidSyncCursor) {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    const txRes = await getPlaidClient().transactionsGet({
      access_token: accessToken,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
    });
    collected.push(...txRes.data.transactions);
  }

  const upserts = [...collected, ...modified].map((txn) => txnToUpsert(user._id, txn));

  if (upserts.length) {
    await Transaction.bulkWrite(upserts as Parameters<typeof Transaction.bulkWrite>[0]);
  }

  if (removedIds.length) {
    await Transaction.deleteMany({
      userId: user._id,
      plaidTransactionId: { $in: removedIds },
      excludedFromTotals: { $ne: true },
    });
  }

  user.plaidSyncCursor = cursor;
  await user.save();

  try {
    await applyRulesToUser(user._id);
  } catch (err) {
    console.warn("Category rules apply failed", err);
  }

  try {
    await syncUserAccounts(user);
  } catch (err) {
    console.warn("Account balance sync failed (transactions still synced)", err);
  }

  return upserts.length;
}

export async function syncUserByItemId(itemId: string): Promise<number | null> {
  const user = await User.findOne({ plaidItemId: itemId }).select("+plaidAccessTokenEnc +plaidAccessToken +plaidSyncCursor");
  if (!user) return null;
  return syncUserTransactions(user);
}
