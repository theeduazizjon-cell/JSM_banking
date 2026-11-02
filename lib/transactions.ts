// Pure helpers for searching, filtering and summarising transactions.
// Transactions arrive normalised from lib/data/bank.ts: `amount` is always
// positive and `type` says whether money left ("debit") or arrived ("credit").

export type TransactionTypeFilter = "all" | "debit" | "credit";

export interface TransactionFilters {
  query: string;
  type: TransactionTypeFilter;
  category: string;
  from: string; // YYYY-MM-DD or ""
  to: string;   // YYYY-MM-DD or ""
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const firstValue = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? "";

// Reads filters from the URL, ignoring anything malformed
export function parseTransactionFilters(
  searchParams: Record<string, string | string[] | undefined>
): TransactionFilters {
  const type = firstValue(searchParams.type);
  const from = firstValue(searchParams.from);
  const to = firstValue(searchParams.to);

  return {
    query: firstValue(searchParams.q).trim().slice(0, 100),
    type: type === "debit" || type === "credit" ? type : "all",
    category: firstValue(searchParams.category).slice(0, 100),
    from: DATE_PATTERN.test(from) ? from : "",
    to: DATE_PATTERN.test(to) ? to : "",
  };
}

export const hasActiveFilters = (filters: TransactionFilters) =>
  Boolean(filters.query || filters.type !== "all" || filters.category || filters.from || filters.to);

// Plaid dates are "YYYY-MM-DD"; Appwrite transfers are full ISO timestamps
const toDay = (date: string) => date.slice(0, 10);

export function filterTransactions(transactions: Transaction[], filters: TransactionFilters) {
  const query = filters.query.toLowerCase();

  return transactions.filter((t) => {
    if (query && !t.name?.toLowerCase().includes(query) && !t.category?.toLowerCase().includes(query)) {
      return false;
    }
    if (filters.type !== "all" && t.type !== filters.type) return false;
    if (filters.category && t.category !== filters.category) return false;

    const day = toDay(t.date);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;

    return true;
  });
}

export const getCategories = (transactions: Transaction[]) =>
  [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export interface MonthlyCashFlow {
  month: string; // YYYY-MM
  label: string; // e.g. "Jun"
  income: number;
  expenses: number;
}

// Income and expenses for the last `months` calendar months, oldest first.
// Pending transactions are left out because their amounts can still change.
export function summarizeCashFlow(transactions: Transaction[], months = 6, now = new Date()): MonthlyCashFlow[] {
  const buckets: MonthlyCashFlow[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      income: 0,
      expenses: 0,
    });
  }

  const byMonth = new Map(buckets.map((b) => [b.month, b]));

  for (const t of transactions) {
    if (t.pending) continue;

    const bucket = byMonth.get(t.date.slice(0, 7));
    if (!bucket) continue;

    if (t.type === "credit") bucket.income += t.amount;
    else bucket.expenses += t.amount;
  }

  // Round once at the end to avoid floating-point drift in the totals
  return buckets.map((b) => ({
    ...b,
    income: Math.round(b.income * 100) / 100,
    expenses: Math.round(b.expenses * 100) / 100,
  }));
}
