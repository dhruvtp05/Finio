export interface TransactionSummary {
  totalSpent: number;
  totalIncome: number;
  totalSpentThisMonth: number;
  totalIncomeThisMonth: number;
  byCategory: Array<{ category: string; total: number }>;
  byMonth: Array<{ month: string; spent: number; income: number }>;
}

export interface TransactionDto {
  _id: string;
  date: string;
  name?: string;
  merchantName?: string;
  category?: string[];
  userCategory?: string;
  suggestedCategory?: string;
  categoryLocked?: boolean;
  amount: number;
  pending?: boolean;
  source?: "plaid" | "manual";
  note?: string;
  excludedFromTotals?: boolean;
  splitFromId?: string;
}

export interface BudgetDto {
  _id: string;
  category: string;
  label: string;
  limit: number;
  spent: number;
}

export interface PlaidStatusDto {
  connected: boolean;
  transactionCount: number;
}

export interface TransactionFiltersDto {
  months: string[];
  categories: string[];
}

export interface PaginatedTransactions {
  transactions: TransactionDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SpendingGroupBy = "day" | "week" | "month" | "year";

export interface SpendingTimelinePoint {
  key: string;
  label: string;
  spent: number;
  income: number;
}

export interface SpendingTimelineDto {
  groupBy: SpendingGroupBy;
  data: SpendingTimelinePoint[];
}

export interface UserProfileDto {
  email: string;
  name?: string;
  image?: string;
  plaidConnected: boolean;
}

export interface CashFlowDto {
  moneyInThisMonth: number;
  moneyOutThisMonth: number;
  netThisMonth: number;
  savingsRatePercent: number | null;
  avgDailySpend: number;
  netWorth: number;
  daysElapsedInMonth: number;
  netWorthSource?: "accounts" | "transactions";
  assets?: number;
  liabilities?: number;
}

export type RecurringCadence = "monthly" | "weekly" | "annual";

export interface RecurringSubscriptionDto {
  merchantKey: string;
  merchantName: string;
  category: string;
  avgAmount: number;
  cadence: RecurringCadence;
  occurrenceCount: number;
  lastDate: string;
  monthsActive: number;
  yearlyCost: number;
  nextExpectedDate: string | null;
}

export interface RecurringDto {
  subscriptions: RecurringSubscriptionDto[];
}

export interface GoalDto {
  _id: string;
  title: string;
  targetAmount: number;
  deadline: string;
  createdAt: string;
  saved: number;
  progressPercent: number;
  completed: boolean;
}

export type AlertSeverity = "info" | "warn" | "critical";

export interface AlertDto {
  key: string;
  kind: "budget" | "goal";
  severity: AlertSeverity;
  title: string;
  message: string;
  href?: string;
}

export interface AlertsResponse {
  alerts: AlertDto[];
}

export interface AccountDto {
  _id: string;
  plaidAccountId: string;
  name: string;
  officialName?: string;
  type: string;
  subtype?: string;
  mask?: string;
  currentBalance: number;
  availableBalance?: number;
  isoCurrencyCode?: string;
  lastSyncedAt: string;
  contribution: number;
}

export interface NetWorthHistoryPoint {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export interface AccountsDto {
  accounts: AccountDto[];
  netWorth: number;
  assets: number;
  liabilities: number;
  history: NetWorthHistoryPoint[];
}

export interface MonthPeriodMetrics {
  key: string;
  label: string;
  spent: number;
  income: number;
  net: number;
  byCategory: Array<{ category: string; total: number }>;
}

export interface MonthCompareDto {
  current: MonthPeriodMetrics;
  previousMonth: MonthPeriodMetrics;
  sameMonthLastYear: MonthPeriodMetrics;
  vsPreviousMonth: {
    spentDelta: number;
    spentDeltaPercent: number | null;
    incomeDelta: number;
    incomeDeltaPercent: number | null;
    netDelta: number;
  };
  vsSameMonthLastYear: {
    spentDelta: number;
    spentDeltaPercent: number | null;
    incomeDelta: number;
    incomeDeltaPercent: number | null;
    netDelta: number;
  };
}
