import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";

const router = Router();

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      email: user.email,
      name: user.name,
      image: user.image,
      plaidConnected: Boolean(user.plaidItemId),
    });
  } catch (error) {
    console.error("users/me failed", error);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

router.post("/sync-profile", auth, async (req, res) => {
  try {
    const { name, image } = req.body as { name?: string; image?: string };
    const user = await User.findOneAndUpdate(
      { email: req.user!.email },
      {
        $set: { email: req.user!.email, ...(name ? { name } : {}), ...(image ? { image } : {}) },
      },
      { upsert: true, new: true }
    );
    res.json({ success: true, user: { email: user.email, name: user.name, image: user.image } });
  } catch (error) {
    console.error("sync-profile failed", error);
    res.status(500).json({ error: "Failed to sync profile" });
  }
});

export default router;
