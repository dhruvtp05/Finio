"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import api from "@/lib/api";
import { toast } from "sonner";

type PlaidLinkContextValue = {
  ready: boolean;
  loading: boolean;
  error: string;
  openLink: () => void;
  refreshToken: () => Promise<void>;
};

const PlaidLinkContext = createContext<PlaidLinkContextValue | null>(null);

export function PlaidLinkProvider({ children, onConnected }: { children: React.ReactNode; onConnected?: () => void }) {
  const [linkToken, setLinkToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshToken = useCallback(async () => {
    const res = await api.post("/api/plaid/create-link-token");
    setLinkToken(res.data.link_token);
    setError("");
  }, []);

  useEffect(() => {
    refreshToken().catch((err: unknown) => {
      setLinkToken("");
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(apiError || "Could not initialize Plaid Link.");
    });
  }, [refreshToken]);

  const onSuccess = useCallback(
    async (public_token: string) => {
      setLoading(true);
      try {
        const exchange = await api.post("/api/plaid/exchange-token", { public_token });
        toast.success(`Bank connected — synced ${exchange.data.synced ?? 0} transactions`);
        onConnected?.();
      } catch (err: unknown) {
        const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(apiError || "Plaid link failed");
        setError(apiError || "Plaid link failed");
      } finally {
        setLoading(false);
      }
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const value = useMemo(
    () => ({
      ready: ready && Boolean(linkToken),
      loading,
      error,
      openLink: () => open(),
      refreshToken,
    }),
    [ready, linkToken, loading, error, open, refreshToken]
  );

  return <PlaidLinkContext.Provider value={value}>{children}</PlaidLinkContext.Provider>;
}

export function usePlaidLinkContext() {
  const ctx = useContext(PlaidLinkContext);
  if (!ctx) throw new Error("usePlaidLinkContext must be used within PlaidLinkProvider");
  return ctx;
}
