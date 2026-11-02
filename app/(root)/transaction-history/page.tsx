import HeaderBox from '@/components/HeaderBox'
import { BankTabItem } from '@/components/BankTabItem';
import { Pagination } from '@/components/Pagination';
import TransactionFilters from '@/components/TransactionFilters';
import TransactionsTable from '@/components/TransactionsTable';
import { getAccount, getAccounts } from '@/lib/data/bank';
import { requireUser } from '@/lib/data/user';
import { filterTransactions, getCategories, hasActiveFilters, parseTransactionFilters } from '@/lib/transactions';
import { formatAmount } from '@/lib/utils';
import React from 'react'
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Transaction History' };

// Next 16 passes searchParams as a Promise
const TransactionHistory = async ({ searchParams }: { searchParams: Promise<SearchParamProps['searchParams']> }) => {
  const params = await searchParams;
  const { id, page } = params;
  const currentPage = Number(page as string) || 1;
  const filters = parseTransactionFilters(params);
  const loggedIn = await requireUser();

  const accounts = await getAccounts({
    userId: loggedIn.$id
  })

  const accountsData = accounts.data;
  const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;

  // A user with no linked banks has no account to look up yet. getAccount
  // returns null for a bank that belongs to someone else.
  const account = appwriteItemId
    ? await getAccount({ appwriteItemId, userId: loggedIn.$id })
    : null;


  const allTransactions = account?.transactions ?? [];
  const filteredTransactions = filterTransactions(allTransactions, filters);
  const filtering = hasActiveFilters(filters);

  const rowsPerPage = 10;
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);

  const indexOfLastTransaction = currentPage * rowsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - rowsPerPage;

  const currentTransactions = filteredTransactions.slice(
    indexOfFirstTransaction, indexOfLastTransaction
  )

  return (
    <div className="transactions">
      <div className="transactions-header">
        <HeaderBox
          title="Transaction History"
          subtext="See your bank details and transactions."
        />
      </div>

      {!account ? (
        <p className="text-16 text-gray-600">
          No bank connected yet. Go to My Banks to connect one and see your transactions.
        </p>
      ) : (
      <div className="space-y-6">
        {accountsData.length > 1 && (
          <nav aria-label="Bank accounts" className="recent-transactions-tablist mb-0">
            {accountsData.map((a: Account) => (
              <BankTabItem
                key={a.id}
                account={a}
                appwriteItemId={appwriteItemId}
                basePath="/transaction-history"
              />
            ))}
          </nav>
        )}
        <div className="transactions-account">
          <div className="flex flex-col gap-2">
            <h2 className="text-18 font-bold text-white">{account.data.name}</h2>
            <p className="text-14 text-blue-25">
              {account?.data.officialName}
            </p>
            <p className="text-14 font-semibold tracking-[1.1px] text-white">
              ●●●● ●●●● ●●●● {account?.data.mask}
            </p>
          </div>

          <div className='transactions-account-balance'>
            <p className="text-14">Current balance</p>
            <p className="text-24 text-center font-bold">{formatAmount(account.data.currentBalance)}</p>
          </div>
        </div>

        <section className="flex w-full flex-col gap-4" aria-label="Transactions">
          <TransactionFilters
            filters={filters}
            categories={getCategories(allTransactions)}
            appwriteItemId={appwriteItemId}
          />

          <p className="text-14 text-gray-600" aria-live="polite">
            {filtering
              ? `${filteredTransactions.length} of ${allTransactions.length} transactions match your filters`
              : `${allTransactions.length} transactions`}
          </p>

          <TransactionsTable
            transactions={currentTransactions}
            emptyMessage={filtering ? 'No transactions match these filters.' : undefined}
          />
            {totalPages > 1 && (
              <div className="my-4 w-full">
                <Pagination totalPages={totalPages} page={currentPage} />
              </div>
            )}
        </section>
      </div>
      )}
    </div>
  )
}

export default TransactionHistory