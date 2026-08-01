"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PlaidConnectCard from "@/components/PlaidConnectCard";
import { PlaidLinkProvider } from "@/context/PlaidLinkContext";
import api from "@/lib/api";
import { FINIO_CATEGORIES } from "@/lib/categories";
import { CategoryRuleDto, UserProfileDto } from "@/lib/types";
import { toast } from "sonner";

export default function SettingsClient() {
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [plaidConnected, setPlaidConnected] = useState(false);
  const [rules, setRules] = useState<CategoryRuleDto[]>([]);
  const [pattern, setPattern] = useState("");
  const [match, setMatch] = useState<"contains" | "exact">("contains");
  const [ruleCategory, setRuleCategory] = useState<string>(FINIO_CATEGORIES[0]);
  const [savingRule, setSavingRule] = useState(false);
  const [applyingRules, setApplyingRules] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await api.get<CategoryRuleDto[]>("/api/rules");
      setRules(res.data || []);
    } catch {
      toast.error("Failed to load category rules");
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, statusRes] = await Promise.all([
        api.get<UserProfileDto>("/api/users/me"),
        api.get<{ connected: boolean }>("/api/plaid/status"),
      ]);
      setProfile(profileRes.data);
      setPlaidConnected(statusRes.data.connected);
      await loadRules();
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [loadRules]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const [recategorizing, setRecategorizing] = useState(false);

  const recategorizeAll = async () => {
    setRecategorizing(true);
    try {
      const res = await api.post<{ updated: number; total: number }>("/api/categories/recategorize-all");
      toast.success(`Updated ${res.data.updated} of ${res.data.total} transactions`);
    } catch {
      toast.error("Failed to refresh categories");
    } finally {
      setRecategorizing(false);
    }
  };

  const addRule = async () => {
    if (!pattern.trim()) return;
    setSavingRule(true);
    try {
      const res = await api.post<{ rule: CategoryRuleDto; applied: number }>("/api/rules", {
        pattern: pattern.trim(),
        match,
        category: ruleCategory,
      });
      setRules((prev) => [res.data.rule, ...prev]);
      setPattern("");
      toast.success(`Rule added · ${res.data.applied} txn(s) updated`);
    } catch {
      toast.error("Failed to add rule");
    } finally {
      setSavingRule(false);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await api.delete(`/api/rules/${id}`);
      setRules((prev) => prev.filter((r) => r._id !== id));
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  const applyAllRules = async () => {
    setApplyingRules(true);
    try {
      const res = await api.post<{ applied: number }>("/api/rules/apply");
      toast.success(`Applied rules to ${res.data.applied} transaction(s)`);
    } catch {
      toast.error("Failed to apply rules");
    } finally {
      setApplyingRules(false);
    }
  };

  const sendWeeklyEmail = async () => {
    setSendingDigest(true);
    try {
      const res = await api.post<{ sent: boolean; to: string }>("/api/insights/weekly/email");
      toast.success(`Digest sent to ${res.data.to}`);
    } catch (err: unknown) {
      const data = (err as { response?: { status?: number; data?: { hint?: string; error?: string } } })?.response;
      if (data?.status === 400) {
        toast.error(data.data?.hint || data.data?.error || "SMTP not configured");
      } else {
        toast.error(data?.data?.error || "Failed to send digest email");
      }
    } finally {
      setSendingDigest(false);
    }
  };

  return (
    <PlaidLinkProvider onConnected={load}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Navbar />

        <div className="mx-auto max-w-3xl space-y-6">
          <div className="finio-card space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="mt-1 text-sm text-slate-500">Account, bank connection, and security.</p>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : (
              <>
                {profile && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{profile.name || "Signed in"}</p>
                    <p className="text-slate-600 dark:text-slate-300">{profile.email}</p>
                    <p className="mt-2 text-slate-500">
                      Plaid: {plaidConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-slate-100">Categories</p>
                  <p className="mt-1">Re-map existing transactions to Finio&apos;s standard categories.</p>
                  <button
                    type="button"
                    onClick={recategorizeAll}
                    disabled={recategorizing}
                    className="finio-btn-secondary mt-3"
                  >
                    {recategorizing ? "Updating..." : "Refresh transaction categories"}
                  </button>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">Category rules</p>
                      <p className="mt-1">Auto-categorize by merchant name pattern.</p>
                    </div>
                    <button
                      type="button"
                      onClick={applyAllRules}
                      disabled={applyingRules || rules.length === 0}
                      className="finio-btn-secondary"
                    >
                      {applyingRules ? "Applying..." : "Apply all"}
                    </button>
                  </div>

                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <input
                      className="finio-input w-full sm:col-span-2"
                      placeholder="Pattern (e.g. Starbucks)"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                    />
                    <select
                      className="finio-input"
                      value={match}
                      onChange={(e) => setMatch(e.target.value as "contains" | "exact")}
                    >
                      <option value="contains">Contains</option>
                      <option value="exact">Exact</option>
                    </select>
                    <select
                      className="finio-input"
                      value={ruleCategory}
                      onChange={(e) => setRuleCategory(e.target.value)}
                    >
                      {FINIO_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addRule}
                      disabled={savingRule || !pattern.trim()}
                      className="finio-btn-primary sm:col-span-2"
                    >
                      {savingRule ? "Adding..." : "Add rule"}
                    </button>
                  </div>

                  {rules.length === 0 ? (
                    <p className="text-xs text-slate-500">No rules yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {rules.map((rule) => (
                        <li
                          key={rule._id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                              {rule.pattern}
                            </p>
                            <p className="text-xs text-slate-500">
                              {rule.match} · {rule.category}
                              {!rule.enabled ? " · disabled" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteRule(rule._id)}
                            className="shrink-0 text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-slate-100">Email digest</p>
                  <p className="mt-1">Send this week&apos;s spending digest to your account email.</p>
                  <button
                    type="button"
                    onClick={sendWeeklyEmail}
                    disabled={sendingDigest}
                    className="finio-btn-primary mt-3"
                  >
                    {sendingDigest ? "Sending..." : "Email weekly digest"}
                  </button>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-slate-100">Security</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>Plaid tokens are encrypted at rest (AES-256-GCM)</li>
                    <li>API routes are rate-limited and protected with Helmet</li>
                    <li>Plaid webhooks auto-sync new transactions</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          {!loading && (
            <PlaidConnectCard connected={plaidConnected} onUpdated={load} />
          )}
        </div>
      </div>
    </PlaidLinkProvider>
  );
}
