"use client";

import { usePlaidLinkContext } from "@/context/PlaidLinkContext";

export default function PlaidLinkButton({ label = "Connect Bank with Plaid" }: { label?: string }) {
  const { ready, loading, error, openLink } = usePlaidLinkContext();

  return (
    <div>
      <button type="button" onClick={openLink} disabled={!ready || loading} className="finio-btn-primary">
        {loading ? "Syncing..." : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
