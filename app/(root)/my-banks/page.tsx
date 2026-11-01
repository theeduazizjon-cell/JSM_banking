import BankCard from '@/components/BankCard';
import HeaderBox from '@/components/HeaderBox'
import { getAccounts } from '@/lib/data/bank';
import { requireUser } from '@/lib/data/user';
import React from 'react'

const MyBanks = async () => {
  const loggedIn = await requireUser();

  const accounts = await getAccounts({
    userId: loggedIn.$id
  })

  return (
    <section className='flex'>
      <div className="my-banks">
        <HeaderBox
          title="My Bank Accounts"
          subtext="Effortlessly manage your banking activites."
        />

        <div className="space-y-4">
          <h2 className="header-2">
            Your cards
          </h2>
          <div className="flex flex-wrap gap-6">
            {accounts.data.length === 0 && (
              <p className="text-16 text-gray-600">
                No banks connected yet. Use Connect bank in the sidebar to add one.
              </p>
            )}
            {accounts.data.map((a: Account) => (
              <BankCard
                key={a.id}
                account={a}
                userName={`${loggedIn.firstName} ${loggedIn.lastName}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default MyBanks