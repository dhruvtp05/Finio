"use client";

import { useState } from "react";
import PlaidLinkButton from "@/components/PlaidLinkButton";
import api from "@/lib/api";

export default function PlaidConnectCard({
  connected,
  onUpdated,
}: {
  connected: boolean;
  onUpdated: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const handleSync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const res = await api.post("/api/plaid/sync");
      if (res.data.synced > 0) {
        setMessage(`Synced ${res.data.synced} transactions.`);
        onUpdated();
      } else {
        setMessage("No new transactions yet. Try again in a minute, or reconnect with sandbox user_good / pass_good.");
      }
    } catch {
      setMessage("Sync failed. Check server/.env Plaid keys and that MongoDB is running.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">
        {connected ? "Sync your sandbox transactions" : "Connect a sandbox bank"}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {connected
          ? "Your bank is linked but no transactions are in Finio yet. Run a sync, or reconnect via Plaid Link."
          : "Use Plaid sandbox credentials when prompted:"}{" "}
        <code className="rounded bg-white px-1">user_good</code> / <code className="rounded bg-white px-1">pass_good</code>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <PlaidLinkButton onConnected={onUpdated} />
        {connected && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg border border-indigo-600 px-4 py-2 text-indigo-700 hover:bg-white disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync transactions"}
          </button>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-slate-700">{message}</p>}
    </div>
  );
}
