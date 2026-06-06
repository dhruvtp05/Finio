"use client";

import { useState } from "react";
import PlaidLinkButton from "@/components/PlaidLinkButton";
import api from "@/lib/api";
import { toast } from "sonner";

export default function PlaidConnectCard({
  connected,
  onUpdated,
}: {
  connected: boolean;
  onUpdated: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post("/api/plaid/sync");
      if (res.data.synced > 0) {
        toast.success(`Synced ${res.data.synced} transactions`);
        onUpdated();
      } else {
        toast.message("No new transactions yet — try again shortly");
      }
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(apiError || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.post("/api/plaid/disconnect");
      toast.success("Bank disconnected");
      onUpdated();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="finio-card border-indigo-200 bg-gradient-to-r from-indigo-50 to-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {connected ? "Manage sandbox bank" : "Connect a sandbox bank"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Use Plaid test credentials <code className="rounded bg-white px-1">user_good</code> /{" "}
            <code className="rounded bg-white px-1">pass_good</code>. Webhooks keep transactions updated after the first
            sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PlaidLinkButton label={connected ? "Reconnect bank" : "Connect Bank with Plaid"} />
          {connected && (
            <>
              <button type="button" onClick={handleSync} disabled={syncing} className="finio-btn-secondary">
                {syncing ? "Syncing..." : "Sync now"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="finio-btn-secondary text-red-600"
              >
                {disconnecting ? "..." : "Disconnect"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
