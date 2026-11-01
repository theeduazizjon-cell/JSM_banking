import "server-only";

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import { parseStringify } from "../utils";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
} = process.env;

export const createTransaction = async (transaction: CreateTransactionProps) => {
  const { database } = await createAdminClient();

  const newTransaction = await database.createDocument(
    DATABASE_ID!,
    TRANSACTION_COLLECTION_ID!,
    ID.unique(),
    {
      channel: 'online',
      category: 'Transfer',
      ...transaction
    }
  )

  return parseStringify(newTransaction);
}

export const getTransactionsByBankId = async ({bankId}: getTransactionsByBankIdProps) => {
  const { database } = await createAdminClient();

  const [senderTransactions, receiverTransactions] = await Promise.all([
    database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal('senderBankId', bankId)],
    ),
    database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal('receiverBankId', bankId)],
    ),
  ]);

  const transactions = {
    total: senderTransactions.total + receiverTransactions.total,
    documents: [
      ...senderTransactions.documents,
      ...receiverTransactions.documents,
    ]
  }

  return parseStringify(transactions);
}
