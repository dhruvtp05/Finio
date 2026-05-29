import { Router } from "express";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";

const router = Router();

let plaidClient: PlaidApi | null = null;

function getPlaidClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();

  if (!clientId || !secret) {
    throw new Error("PLAID_CLIENT_ID and PLAID_SECRET must be set in server/.env");
  }

  if (!plaidClient) {
    const plaidEnv = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
    const plaidBasePath = PlaidEnvironments[plaidEnv] ?? PlaidEnvironments.sandbox;

    plaidClient = new PlaidApi(
      new Configuration({
        basePath: plaidBasePath,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": clientId,
            "PLAID-SECRET": secret,
          },
        },
      })
    );
  }

  return plaidClient;
}

function plaidErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { error_message?: string; error_code?: string } } })
    ?.response?.data;
  if (data?.error_message) {
    return data.error_code ? `${data.error_code}: ${data.error_message}` : data.error_message;
  }
  if (error instanceof Error) return error.message;
  return "Unknown Plaid error";
}

async function findOrCreateUser(email: string) {
  return (User as any).findOneAndUpdate(
    { email },
    { $setOnInsert: { email } },
    { upsert: true, new: true }
  );
}

router.get("/status", auth, async (req, res) => {
  try {
    const user = await (User as any).findOne({ email: req.user!.email });
    const connected = Boolean(user?.plaidAccessToken);
    const transactionCount = user
      ? await (Transaction as any).countDocuments({ userId: user._id })
      : 0;

    res.json({ connected, transactionCount });
  } catch (error) {
    console.error("plaid/status failed", error);
    res.status(500).json({ error: "Failed to load Plaid status" });
  }
});

router.post("/create-link-token", auth, async (req, res) => {
  try {
    const user = await findOrCreateUser(req.user!.email);

    const plaidRes = await getPlaidClient().linkTokenCreate({
      user: { client_user_id: user._id.toString() },
      client_name: "Finio",
      language: "en",
      country_codes: [CountryCode.Us],
      products: [Products.Transactions],
    });

    res.json({ link_token: plaidRes.data.link_token });
  } catch (error) {
    console.error("create-link-token failed", (error as any)?.response?.data || error);
    res.status(500).json({ error: plaidErrorMessage(error) });
  }
});

router.post("/exchange-token", auth, async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token) return res.status(400).json({ error: "public_token is required" });

    const exchange = await getPlaidClient().itemPublicTokenExchange({ public_token });

    await (User as any).findOneAndUpdate(
      { email: req.user!.email },
      {
        plaidAccessToken: exchange.data.access_token,
        plaidItemId: exchange.data.item_id,
        connectedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("exchange-token failed", (error as any)?.response?.data || error);
    res.status(500).json({ error: plaidErrorMessage(error) });
  }
});

function txnToUpsert(userId: unknown, txn: {
  transaction_id: string;
  name: string;
  amount: number;
  category?: string[] | null;
  date: string;
  merchant_name?: string | null;
  pending?: boolean | null;
}) {
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
          date: new Date(txn.date),
          merchantName: txn.merchant_name,
          pending: txn.pending,
        },
      },
      upsert: true,
    },
  };
}

router.post("/sync", auth, async (req, res) => {
  try {
    const user = await (User as any).findOne({ email: req.user!.email });
    if (!user?.plaidAccessToken) return res.status(400).json({ error: "No connected Plaid account" });

    const collected: Array<{
      transaction_id: string;
      name: string;
      amount: number;
      category?: string[] | null;
      date: string;
      merchant_name?: string | null;
      pending?: boolean | null;
    }> = [];

    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const syncRes = await getPlaidClient().transactionsSync({
        access_token: user.plaidAccessToken,
        cursor,
      });
      collected.push(...syncRes.data.added);
      cursor = syncRes.data.next_cursor;
      hasMore = syncRes.data.has_more;
    }

    if (!collected.length) {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const end = new Date();
      const txRes = await getPlaidClient().transactionsGet({
        access_token: user.plaidAccessToken,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
      });
      collected.push(...txRes.data.transactions);
    }

    const ops = collected.map((txn) => txnToUpsert(user._id, txn));

    if (ops.length) {
      await (Transaction as any).bulkWrite(ops);
    }

    res.json({ synced: ops.length });
  } catch (error) {
    console.error("sync failed", (error as any)?.response?.data || error);
    res.status(500).json({ error: plaidErrorMessage(error) });
  }
});

export default router;
