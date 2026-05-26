import { Router } from "express";
import { Configuration, PlaidApi, PlaidEnvironments, Products } from "plaid";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";

const router = Router();

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[(process.env.PLAID_ENV || "sandbox") as "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);

router.post("/create-link-token", auth, async (req, res) => {
  const email = req.user!.email;
  let user = await (User as any).findOne({ email });
  if (!user) user = await (User as any).create({ email });

  const plaidRes = await plaidClient.linkTokenCreate({
    user: { client_user_id: user._id.toString() },
    client_name: "Finio",
    language: "en",
    country_codes: ["US" as any],
    products: [Products.Transactions],
  });

  res.json({ link_token: plaidRes.data.link_token });
});

router.post("/exchange-token", auth, async (req, res) => {
  const { public_token } = req.body;
  if (!public_token) return res.status(400).json({ error: "public_token is required" });

  const exchange = await plaidClient.itemPublicTokenExchange({ public_token });

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
});

router.post("/sync", auth, async (req, res) => {
  const user = await (User as any).findOne({ email: req.user!.email });
  if (!user?.plaidAccessToken) return res.status(400).json({ error: "No connected Plaid account" });

  const start = new Date();
  start.setDate(start.getDate() - 30);
  const end = new Date();

  const txRes = await plaidClient.transactionsGet({
    access_token: user.plaidAccessToken,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  });

  const ops = txRes.data.transactions.map((txn) => ({
    updateOne: {
      filter: { plaidTransactionId: txn.transaction_id },
      update: {
        userId: user._id,
        plaidTransactionId: txn.transaction_id,
        name: txn.name,
        amount: txn.amount,
        category: txn.category || [],
        date: txn.date,
        merchantName: txn.merchant_name,
        pending: txn.pending,
      },
      upsert: true,
    },
  }));

  if (ops.length) {
    await (Transaction as any).bulkWrite(ops);
  }

  res.json({ synced: ops.length });
});

export default router;
