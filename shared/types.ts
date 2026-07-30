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
  tags?: string[];
  isCreditCardPayment?: boolean;
  hasReceipt?: boolean;
  receiptUrl?: string;
  excludedFromTotals?: boolean;
  splitFromId?: string;
}

export interface BudgetDto {
  _id: string;
  category: string;
  label: string;
  limit: number;
  spent: number;
  rolloverEnabled?: boolean;
  rolloverAmount?: number;
  effectiveLimit?: number;
}

export interface PlaidStatusDto {
  connected: boolean;
  transactionCount: number;
}

export interface TransactionFiltersDto {
  months: string[];
  categories: string[];
  tags?: string[];
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
  rangeStart?: string;
  rangeEnd?: string;
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
  fromCashFlow?: number;
  fromContributions?: number;
  progressPercent: number;
  completed: boolean;
  contributions?: Array<{ _id: string; amount: number; date: string; note?: string }>;
}

export interface CategoryRuleDto {
  _id: string;
  pattern: string;
  match: "contains" | "exact";
  category: string;
  enabled: boolean;
}

export interface BillCalendarItemDto {
  merchantName: string;
  category: string;
  amount: number;
  dueDate: string;
  cadence: string;
  merchantKey: string;
}

export interface RunwayDto {
  liquidAssets: number;
  avgMonthlySpend: number;
  avgMonthlyIncome: number;
  avgMonthlyNet: number;
  runwayMonths: number | null;
  monthlyBurn: number;
  cancelledMonthlySavings: number;
  projectedRunwayMonths: number | null;
  subscriptions: Array<{
    merchantKey: string;
    merchantName: string;
    monthlyCost: number;
    yearlyCost: number;
  }>;
}

export interface HeatmapDto {
  byDayOfWeek: Array<{ day: string; dayIndex: number; spent: number; count: number }>;
  byMerchant: Array<{ merchant: string; spent: number }>;
  daysBack: number;
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

export interface WeeklyDigestDto {
  weekLabel: string;
  thisWeek: { spent: number; income: number; net: number };
  lastWeek: { spent: number; income: number; net: number };
  spentDelta: number;
  spentDeltaPercent: number | null;
  topMerchants: Array<{ name: string; total: number }>;
  budgetWarnings: Array<{ label: string; pct: number }>;
  highlights: string[];
}

export interface MerchantInsightDto {
  merchantKey: string;
  merchantName: string;
  total: number;
  count: number;
  lastDate: string;
  category: string;
}

export interface MerchantsInsightsResponse {
  year: number;
  merchants: MerchantInsightDto[];
}
