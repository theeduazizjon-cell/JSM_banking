import BankCard from '@/components/BankCard';
import HeaderBox from '@/components/HeaderBox'
import PlaidLink from '@/components/PlaidLink';
import { getAccounts } from '@/lib/data/bank';
import { requireUser } from '@/lib/data/user';
import React from 'react'

const MyBanks = async () => {
  const loggedIn = await requireUser();

  const accounts = await getAccounts({
    userId: loggedIn.$id
  })

  return (
    <section className='flex flex-1'>
      <div className="my-banks">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <HeaderBox
            title="My Bank Accounts"
            subtext="Manage the bank accounts linked to Horizon."
          />
          <div className="w-full sm:w-auto">
            <PlaidLink variant="primary" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="header-2">
            Your accounts
          </h2>
          <div className="flex flex-wrap gap-6">
            {accounts.data.length === 0 && (
              <p className="text-16 text-gray-600">
                No banks connected yet. Use Connect bank to link one from Plaid&apos;s sandbox.
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