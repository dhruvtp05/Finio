import { Router } from "express";
import { CountryCode, Products } from "plaid";
import auth from "../middleware/auth";
import User from "../models/User";
import Transaction from "../models/Transaction";
import { getPlaidClient, plaidErrorMessage } from "../services/plaidClient";
import { getUserAccessToken, setUserAccessToken, syncUserByItemId, syncUserTransactions } from "../services/plaidSync";

const router = Router();

async function findOrCreateUser(email: string) {
  return User.findOneAndUpdate({ email }, { $setOnInsert: { email } }, { upsert: true, new: true });
}

router.get("/status", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email }).select("+plaidAccessTokenEnc +plaidAccessToken");
    const connected = Boolean(user && getUserAccessToken(user));
    const transactionCount = user ? await Transaction.countDocuments({ userId: user._id }) : 0;
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
      ...(process.env.PLAID_WEBHOOK_URL ? { webhook: process.env.PLAID_WEBHOOK_URL } : {}),
    });

    res.json({ link_token: plaidRes.data.link_token });
  } catch (error) {
    console.error("create-link-token failed", (error as { response?: { data?: unknown } })?.response?.data || error);
    res.status(500).json({ error: plaidErrorMessage(error) });
  }
});

router.post("/exchange-token", auth, async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token) return res.status(400).json({ error: "public_token is required" });

    const exchange = await getPlaidClient().itemPublicTokenExchange({ public_token });
    const user = await User.findOneAndUpdate(
      { email: req.user!.email },
      {
        plaidItemId: exchange.data.item_id,
        connectedAt: new Date(),
        plaidSyncCursor: undefined,
      },
      { upsert: true, new: true }
    );

    if (!user) return res.status(500).json({ error: "Failed to save user" });

    await setUserAccessToken(user, exchange.data.access_token);
    const synced = await syncUserTransactions(user);

    res.json({ success: true, synced });
  } catch (error) {
    console.error("exchange-token failed", (error as { response?: { data?: unknown } })?.response?.data || error);
    res.status(500).json({ error: plaidErrorMessage(error) });
  }
});

router.post("/sync", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email }).select("+plaidAccessTokenEnc +plaidAccessToken +plaidSyncCursor");
    if (!user || !getUserAccessToken(user)) {
      return res.status(400).json({ error: "No connected Plaid account" });
    }

    const synced = await syncUserTransactions(user);
    res.json({ synced });
  } catch (error) {
    console.error("sync failed", (error as { response?: { data?: unknown } })?.response?.data || error);
    res.status(500).json({ error: plaidErrorMessage(error) });
  }
});

router.post("/disconnect", auth, async (req, res) => {
  try {
    await User.findOneAndUpdate(
      { email: req.user!.email },
      {
        $unset: {
          plaidAccessToken: "",
          plaidAccessTokenEnc: "",
          plaidItemId: "",
          plaidSyncCursor: "",
          connectedAt: "",
        },
      }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("disconnect failed", error);
    res.status(500).json({ error: "Failed to disconnect Plaid" });
  }
});

router.post("/webhook", async (req, res) => {
  try {
    const { webhook_type, webhook_code, item_id } = req.body as {
      webhook_type?: string;
      webhook_code?: string;
      item_id?: string;
    };

    if (webhook_type === "TRANSACTIONS" && item_id) {
      const relevantCodes = ["SYNC_UPDATES_AVAILABLE", "DEFAULT_UPDATE", "INITIAL_UPDATE", "HISTORICAL_UPDATE"];
      if (!webhook_code || relevantCodes.includes(webhook_code)) {
        await syncUserByItemId(item_id);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("webhook failed", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
