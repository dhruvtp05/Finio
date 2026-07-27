"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import PlaidConnectCard from "@/components/PlaidConnectCard";
import { PlaidLinkProvider } from "@/context/PlaidLinkContext";
import api from "@/lib/api";
import { UserProfileDto } from "@/lib/types";
import { toast } from "sonner";

export default function SettingsClient() {
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [plaidConnected, setPlaidConnected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, statusRes] = await Promise.all([
        api.get<UserProfileDto>("/api/users/me"),
        api.get<{ connected: boolean }>("/api/plaid/status"),
      ]);
      setProfile(profileRes.data);
      setPlaidConnected(statusRes.data.connected);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <PlaidLinkProvider onConnected={load}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Navbar />

        <div className="space-y-6">
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
