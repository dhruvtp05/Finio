"use client";

import { AlertDto } from "@/lib/types";
import api from "@/lib/api";
import { toast } from "sonner";

const styles: Record<AlertDto["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100",
  warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100",
};

export default function AlertsBanner({
  alerts,
  onDismissed,
}: {
  alerts: AlertDto[];
  onDismissed: () => void;
}) {
  if (!alerts.length) return null;

  const dismiss = async (key: string) => {
    try {
      await api.post("/api/alerts/dismiss", { key });
      onDismissed();
    } catch {
      toast.error("Could not dismiss alert");
    }
  };

  return (
    <div className="mb-6 space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.key}
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${styles[alert.severity]}`}
        >
          <div>
            <p className="font-semibold">{alert.title}</p>
            <p className="mt-0.5 opacity-90">{alert.message}</p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(alert.key)}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
