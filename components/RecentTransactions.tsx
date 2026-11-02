import Link from 'next/link'
import { BankTabItem } from './BankTabItem'
import BankInfo from './BankInfo'
import TransactionsTable from './TransactionsTable'
import { Pagination } from './Pagination'

const RecentTransactions = ({
  accounts,
  transactions = [],
  appwriteItemId,
  page = 1,
}: RecentTransactionsProps) => {
  const rowsPerPage = 10;
  const totalPages = Math.ceil(transactions.length / rowsPerPage);

  const indexOfLastTransaction = page * rowsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - rowsPerPage;

  const currentTransactions = transactions.slice(
    indexOfFirstTransaction, indexOfLastTransaction
  )

  const selectedAccount = accounts.find((account) => account.appwriteItemId === appwriteItemId);

  return (
    <section className="recent-transactions" aria-labelledby="recent-transactions-heading">
      <header className="flex items-center justify-between">
        <h2 id="recent-transactions-heading" className="recent-transactions-label">Recent transactions</h2>
        {selectedAccount && (
          <Link
            href={`/transaction-history/?id=${appwriteItemId}`}
            className="view-all-btn"
          >
            View all
          </Link>
        )}
      </header>

      {!selectedAccount ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center">
          <p className="text-16 font-semibold text-gray-900">No bank connected yet</p>
          <p className="text-14 max-w-sm text-gray-600">
            Link a bank to see your balances and recent transactions here.
          </p>
          <Link href="/my-banks" className="form-link mt-2">
            Connect a bank
          </Link>
        </div>
      ) : (
        <>
          <nav aria-label="Bank accounts" className="recent-transactions-tablist">
            {accounts.map((account: Account) => (
              <BankTabItem
                key={account.id}
                account={account}
                appwriteItemId={appwriteItemId}
              />
            ))}
          </nav>

          <div className="space-y-4">
            <BankInfo
              account={selectedAccount}
              appwriteItemId={appwriteItemId}
              type="full"
            />

            <TransactionsTable transactions={currentTransactions} />

            {totalPages > 1 && (
              <div className="my-4 w-full">
                <Pagination totalPages={totalPages} page={page} />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default RecentTransactions
