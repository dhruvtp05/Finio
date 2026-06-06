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
  amount: number;
  pending?: boolean;
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
}

export interface RecurringSubscriptionDto {
  merchantKey: string;
  merchantName: string;
  category: string;
  avgAmount: number;
  cadence: "monthly" | "weekly";
  occurrenceCount: number;
  lastDate: string;
  monthsActive: number;
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
