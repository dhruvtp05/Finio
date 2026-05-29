"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import api from "@/lib/api";

export default function PlaidLinkButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchToken = async () => {
    const res = await api.post("/api/plaid/create-link-token");
    setLinkToken(res.data.link_token);
    setError("");
  };

  useEffect(() => {
    fetchToken().catch((err: unknown) => {
      setLinkToken("");
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(
        apiError ||
          "Could not start Plaid. Check server terminal, MongoDB Atlas, and Plaid sandbox keys in server/.env."
      );
    });
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      setLoading(true);
      try {
        await api.post("/api/plaid/exchange-token", { public_token });
        const syncRes = await api.post("/api/plaid/sync");
        if (!syncRes.data.synced) {
          setError("Bank linked, but 0 transactions synced. Try again in a minute or re-open Link.");
        }
        onConnected();
      } catch {
        setError("Plaid link failed. Check server logs and Plaid sandbox credentials.");
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <div>
      <button
        onClick={() => open()}
        disabled={!ready || !linkToken || loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Connect Bank with Plaid"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
