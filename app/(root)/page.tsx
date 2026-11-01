import HeaderBox from '@/components/HeaderBox';
import RecentTransactions from '@/components/RecentTransactions';
import RightSidebar from '@/components/RightSidebar';
import TotalBalanceBox from '@/components/TotalBalanceBox';
import { getAccount, getAccounts } from '@/lib/data/bank';
import { requireUser, toPublicUser } from '@/lib/data/user';
import React from 'react'

// Next 16 passes searchParams as a Promise
const Home = async ({ searchParams }: { searchParams: Promise<SearchParamProps['searchParams']> }) => {
  const { id, page } = await searchParams;
  const currentPage = Number(page as string) || 1;
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

  return (
    <section className="home">
       <div className="home-content">
        <header className="home-header">
          <HeaderBox 
          type="greeting"
          title="Welcome"
          user={loggedIn?.firstName || 'Guest'}
          subtext = "Access and manage your account and transactions efficiently."
          />
          <TotalBalanceBox
          accounts={accountsData}
          totalBanks={accounts.totalBanks}
          totalCurrentBalance={accounts.totalCurrentBalance}
          />
        </header>

        <RecentTransactions
          accounts={accountsData}
          transactions={account?.transactions ?? []}
          appwriteItemId={appwriteItemId}
          page={currentPage}
        />
      </div>

      <RightSidebar
        user={toPublicUser(loggedIn)}
        transactions={account?.transactions ?? []}
        banks={accountsData.slice(0, 2)}
      />
    </section>
  )
};

export default Home; 