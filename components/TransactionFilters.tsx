import Link from "next/link";

import type { TransactionFilters as Filters } from "@/lib/transactions";

interface TransactionFiltersProps {
  filters: Filters;
  categories: string[];
  appwriteItemId?: string;
}

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-14 text-gray-900 focus-visible:border-ring";

// A plain GET form: filters live in the URL, so they work without JavaScript,
// survive reloads and can be shared or bookmarked.
const TransactionFilters = ({ filters, categories, appwriteItemId }: TransactionFiltersProps) => {
  const clearHref = appwriteItemId ? `/transaction-history?id=${appwriteItemId}` : "/transaction-history";

  return (
    <form
      method="get"
      action="/transaction-history"
      role="search"
      aria-label="Filter transactions"
      className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      {appwriteItemId && <input type="hidden" name="id" value={appwriteItemId} />}

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-12 font-medium text-gray-700">Search</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          placeholder="Merchant or category"
          maxLength={100}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-12 font-medium text-gray-700">Type</span>
        <select name="type" defaultValue={filters.type} className={fieldClass}>
          <option value="all">All</option>
          <option value="credit">Money in</option>
          <option value="debit">Money out</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-12 font-medium text-gray-700">Category</span>
        <select name="category" defaultValue={filters.category} className={fieldClass}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-12 font-medium text-gray-700">From</span>
        <input type="date" name="from" defaultValue={filters.from} className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-12 font-medium text-gray-700">To</span>
        <input type="date" name="to" defaultValue={filters.to} className={fieldClass} />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-6 lg:justify-end">
        <Link href={clearHref} className="text-14 px-3 py-2 font-semibold text-gray-600 hover:text-gray-900">
          Clear
        </Link>
        <button type="submit" className="form-btn px-6">
          Apply filters
        </button>
      </div>
    </form>
  );
};

export default TransactionFilters;
