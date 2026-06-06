import { Types } from "mongoose";
import Transaction from "../models/Transaction";
import User, { IUserDocument } from "../models/User";
import { decryptSecret, encryptSecret } from "../utils/crypto";
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
        },
      },
      upsert: true,
    },
  };
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
    await Transaction.deleteMany({ userId: user._id, plaidTransactionId: { $in: removedIds } });
  }

  user.plaidSyncCursor = cursor;
  await user.save();

  return upserts.length;
}

export async function syncUserByItemId(itemId: string): Promise<number | null> {
  const user = await User.findOne({ plaidItemId: itemId }).select("+plaidAccessTokenEnc +plaidAccessToken +plaidSyncCursor");
  if (!user) return null;
  return syncUserTransactions(user);
}
