import HeaderBox from '@/components/HeaderBox'
import PaymentTransferForm from '@/components/PaymentTransferForm'
import { getAccounts } from '@/lib/data/bank';
import { requireUser } from '@/lib/data/user';
import React from 'react'

const Transfer = async () => {
  const loggedIn = await requireUser();

  const accounts = await getAccounts({
    userId: loggedIn.$id
  })

  const accountsData = accounts.data;

  return (
    <section className="payment-transfer">
      <HeaderBox
        title="Payment Transfer"
        subtext="Please provide any specific details or notes related to the payment transfer"
      />

      <section className="size-full pt-5">
        {accountsData.length > 0 ? (
          <PaymentTransferForm accounts={accountsData} />
        ) : (
          <p className="text-16 text-gray-600">
            Connect a bank from the sidebar before making a transfer.
          </p>
        )}
      </section>
    </section>
  )
}

export default Transfer