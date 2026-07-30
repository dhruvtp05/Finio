import { Router } from "express";
import auth from "../middleware/auth";
import User from "../models/User";
import CategoryRule from "../models/CategoryRule";
import { isFinioCategory } from "../services/categorization";
import { applyRulesToUser } from "../services/plaidSync";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.json([]);
    const rules = await CategoryRule.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json(
      rules.map((r) => ({
        _id: r._id.toString(),
        pattern: r.pattern,
        match: r.match,
        category: r.category,
        enabled: r.enabled,
      }))
    );
  } catch (error) {
    console.error("rules GET failed", error);
    res.status(500).json({ error: "Failed to load rules" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { pattern, match, category, enabled } = req.body as {
      pattern?: string;
      match?: "contains" | "exact";
      category?: string;
      enabled?: boolean;
    };

    if (!pattern?.trim() || !category || !isFinioCategory(category)) {
      return res.status(400).json({ error: "pattern and valid category required" });
    }

    const rule = await CategoryRule.create({
      userId: user._id,
      pattern: pattern.trim(),
      match: match === "exact" ? "exact" : "contains",
      category,
      enabled: enabled !== false,
    });

    const applied = await applyRulesToUser(user._id);
    res.status(201).json({
      rule: {
        _id: rule._id.toString(),
        pattern: rule.pattern,
        match: rule.match,
        category: rule.category,
        enabled: rule.enabled,
      },
      applied,
    });
  } catch (error) {
    console.error("rules POST failed", error);
    res.status(500).json({ error: "Failed to create rule" });
  }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { pattern, match, category, enabled } = req.body as {
      pattern?: string;
      match?: "contains" | "exact";
      category?: string;
      enabled?: boolean;
    };

    if (category !== undefined && !isFinioCategory(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }

    const rule = await CategoryRule.findOneAndUpdate(
      { _id: req.params.id, userId: user._id },
      {
        ...(pattern !== undefined ? { pattern: pattern.trim() } : {}),
        ...(match !== undefined ? { match } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(typeof enabled === "boolean" ? { enabled } : {}),
      },
      { new: true }
    );
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    const applied = await applyRulesToUser(user._id);
    res.json({
      rule: {
        _id: rule._id.toString(),
        pattern: rule.pattern,
        match: rule.match,
        category: rule.category,
        enabled: rule.enabled,
      },
      applied,
    });
  } catch (error) {
    console.error("rules PUT failed", error);
    res.status(500).json({ error: "Failed to update rule" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = await CategoryRule.deleteOne({ _id: req.params.id, userId: user._id });
    if (!result.deletedCount) return res.status(404).json({ error: "Rule not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("rules DELETE failed", error);
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

router.post("/apply", auth, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user!.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    const applied = await applyRulesToUser(user._id);
    res.json({ applied });
  } catch (error) {
    console.error("rules apply failed", error);
    res.status(500).json({ error: "Failed to apply rules" });
  }
});

export default router;
