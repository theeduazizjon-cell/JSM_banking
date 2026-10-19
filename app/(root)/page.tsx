import HeaderBox from '@/components/HeaderBox';
import RightSidebar from '@/components/RightSidebar';
import TotalBalanceBox from '@/components/TotalBalanceBox';
import { getLoggedInUser } from '@/lib/actions/user.actions';
import { redirect } from 'next/navigation';
import React from 'react'

const Home = async () => {
  const loggedIn = await getLoggedInUser();

  if (!loggedIn) redirect('/sign-in')

  return (
    <section className="home">
       <div className="home-content">
        <header className="home-header">
          <HeaderBox 
          type="greeting"
          title="Welcome"
          user={loggedIn?.name || 'Guest'}
          subtext = "Access and manage your account and transactions efficiently."
          />
        </header>
        <TotalBalanceBox  
        accounts={[]}
        totalBanks={1}
        totalCurrentBalance={1250}
        />
      </div>

      <RightSidebar
        user={loggedIn}
        transactions={[]}
        banks={[{ currentBalance: 123.50 }, { currentBalance: 500.50 }] as React.ComponentProps<typeof RightSidebar>["banks"]}
      />
    </section>
  )
};

export default Home; 