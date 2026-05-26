"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import api from "@/lib/api";

export default function PlaidLinkButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchToken = async () => {
    const res = await api.post("/api/plaid/create-link-token");
    setLinkToken(res.data.link_token);
  };

  useEffect(() => {
    fetchToken().catch(() => setLinkToken(""));
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      setLoading(true);
      try {
        await api.post("/api/plaid/exchange-token", { public_token });
        await api.post("/api/plaid/sync");
        onConnected();
      } finally {
        setLoading(false);
      }
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready || !linkToken || loading}
      className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
    >
      {loading ? "Syncing..." : "Connect Bank with Plaid"}
    </button>
  );
}
