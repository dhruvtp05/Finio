export type AlertSeverity = "info" | "warn" | "critical";
export type AlertKind = "budget" | "goal";

export interface AlertDto {
  key: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  message: string;
  href?: string;
}

export interface BudgetAlertInput {
  _id: string;
  label: string;
  category: string;
  limit: number;
  spent: number;
}

export interface GoalAlertInput {
  _id: string;
  title: string;
  targetAmount: number;
  deadline: Date;
  saved: number;
  completed: boolean;
  createdAt: Date;
}

function daysUntil(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeAlerts(
  budgets: BudgetAlertInput[],
  goals: GoalAlertInput[],
  dismissedKeys: string[] = [],
  now = new Date()
): AlertDto[] {
  const dismissed = new Set(dismissedKeys);
  const alerts: AlertDto[] = [];

  budgets.forEach((b) => {
    if (b.limit <= 0) return;
    const pct = (b.spent / b.limit) * 100;
    if (pct >= 100) {
      const key = `budget:${b._id}:over`;
      if (!dismissed.has(key)) {
        alerts.push({
          key,
          kind: "budget",
          severity: "critical",
          title: `${b.label} over budget`,
          message: `Spent $${b.spent.toFixed(0)} of $${b.limit} (${Math.round(pct)}%).`,
          href: "/dashboard",
        });
      }
    } else if (pct >= 80) {
      const key = `budget:${b._id}:warn`;
      if (!dismissed.has(key)) {
        alerts.push({
          key,
          kind: "budget",
          severity: "warn",
          title: `${b.label} nearing limit`,
          message: `You've used ${Math.round(pct)}% of your $${b.limit} ${b.label} budget.`,
          href: "/dashboard",
        });
      }
    }
  });

  goals.forEach((g) => {
    if (g.completed) return;
    const days = daysUntil(g.deadline, now);

    if (days < 0) {
      const key = `goal:${g._id}:overdue`;
      if (!dismissed.has(key)) {
        alerts.push({
          key,
          kind: "goal",
          severity: "critical",
          title: `${g.title} deadline passed`,
          message: `Saved $${g.saved.toFixed(0)} of $${g.targetAmount.toFixed(0)}.`,
          href: "/dashboard",
        });
      }
      return;
    }

    if (days <= 14) {
      const key = `goal:${g._id}:deadline`;
      if (!dismissed.has(key)) {
        alerts.push({
          key,
          kind: "goal",
          severity: days <= 7 ? "critical" : "warn",
          title: `${g.title} due in ${days} day${days === 1 ? "" : "s"}`,
          message: `Progress: $${g.saved.toFixed(0)} / $${g.targetAmount.toFixed(0)}.`,
          href: "/dashboard",
        });
      }
    }

    // Behind pace: expected linear progress vs actual
    const totalDays = Math.max(
      1,
      Math.ceil((g.deadline.getTime() - g.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );
    const elapsed = Math.max(
      1,
      Math.ceil((now.getTime() - g.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );
    const expected = (elapsed / totalDays) * g.targetAmount;
    if (expected > 0 && g.saved < expected * 0.7 && days > 14) {
      const key = `goal:${g._id}:behind`;
      if (!dismissed.has(key)) {
        alerts.push({
          key,
          kind: "goal",
          severity: "info",
          title: `${g.title} behind pace`,
          message: `On track you'd have ~$${expected.toFixed(0)}; you're at $${g.saved.toFixed(0)}.`,
          href: "/dashboard",
        });
      }
    }
  });

  const order = { critical: 0, warn: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
