import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import Account from "../models/Account";
import NetWorthSnapshot from "../models/NetWorthSnapshot";
import { getUserAccessToken, syncUserAccounts } from "../services/plaidSync";
import { accountContribution, computeNetWorthFromAccounts } from "../utils/netWorth";
import { plaidErrorMessage } from "../services/plaidClient";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) {
      return res.json({
        accounts: [],
        netWorth: 0,
        assets: 0,
        liabilities: 0,
        history: [],
      });
    }

    const accounts = await Account.find({ userId: user._id }).sort({ type: 1, name: 1 });
    const totals = computeNetWorthFromAccounts(accounts);
    const history = await NetWorthSnapshot.find({ userId: user._id }).sort({ date: 1 }).limit(90);

    res.json({
      accounts: accounts.map((a) => {
        const contrib = accountContribution(a.type, a.currentBalance);
        return {
          _id: a._id.toString(),
          plaidAccountId: a.plaidAccountId,
          name: a.name,
          officialName: a.officialName,
          type: a.type,
          subtype: a.subtype,
          mask: a.mask,
          currentBalance: a.currentBalance,
          availableBalance: a.availableBalance,
          isoCurrencyCode: a.isoCurrencyCode,
          lastSyncedAt: a.lastSyncedAt.toISOString(),
          contribution: contrib.net,
        };
      }),
      ...totals,
      history: history.map((h) => ({
        date: h.date.toISOString(),
        netWorth: h.netWorth,
        assets: h.assets,
        liabilities: h.liabilities,
      })),
    });
  } catch (error) {
    console.error("accounts GET failed", error);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

router.post("/sync", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email }).select("+plaidAccessTokenEnc +plaidAccessToken");
    if (!user || !getUserAccessToken(user)) {
      return res.status(400).json({ error: "No connected Plaid account" });
    }
    const count = await syncUserAccounts(user);
    res.json({ synced: count });
  } catch (error) {
    console.error("accounts sync failed", error);
    res.status(500).json({ error: plaidErrorMessage(error) });
  }
});

export default router;
