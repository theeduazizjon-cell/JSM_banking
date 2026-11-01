import "server-only";

import { cache } from "react";
import { ID, Query } from "node-appwrite";
import { CountryCode, Transaction as PlaidTransaction } from "plaid";

import { createAdminClient } from "../appwrite";
import { decryptSecret, encryptSecret } from "../crypto";
import { plaidClient } from "../plaid";
import { parseStringify } from "../utils";

import { getTransactionsByBankId } from "./transaction";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

// `userId` is a many-to-one relationship, which Appwrite returns either as the
// related document or as its ID depending on the query.
export const getBankOwnerId = (bank: Bank) =>
  typeof bank.userId === "string" ? bank.userId : bank.userId?.$id;

// Bank documents with the Plaid access token decrypted. Never return these to
// the client.
const withDecryptedToken = (bank: Bank): Bank => ({
  ...bank,
  accessToken: decryptSecret(bank.accessToken),
});

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  const { database } = await createAdminClient();

  const bankAccount = await database.createDocument(
    DATABASE_ID!,
    BANK_COLLECTION_ID!,
    ID.unique(),
    {
      userId,
      bankId,
      accountId,
      accessToken: encryptSecret(accessToken),
      fundingSourceUrl,
      shareableId,
    }
  )

  return bankAccount.$id;
}

export const getBanks = async ({ userId }: getBanksProps): Promise<Bank[]> => {
  const { database } = await createAdminClient();

  const banks = await database.listDocuments(
    DATABASE_ID!,
    BANK_COLLECTION_ID!,
    [Query.equal('userId', [userId])]
  )

  return parseStringify(banks.documents).map(withDecryptedToken);
}

// Returns the bank only if it belongs to `userId`, so a bank ID taken from the
// URL or a form can never expose or move another user's money.
export const getOwnedBank = async ({ documentId, userId }: getOwnedBankProps): Promise<Bank | null> => {
  const { database } = await createAdminClient();

  const banks = await database.listDocuments(
    DATABASE_ID!,
    BANK_COLLECTION_ID!,
    [Query.equal('$id', [documentId])]
  )

  const bank: Bank | undefined = parseStringify(banks.documents[0]);

  if (!bank || getBankOwnerId(bank) !== userId) return null;

  return withDecryptedToken(bank);
}

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps): Promise<Bank | null> => {
  const { database } = await createAdminClient();

  const bank = await database.listDocuments(
    DATABASE_ID!,
    BANK_COLLECTION_ID!,
    [Query.equal('accountId', [accountId])]
  )

  if(bank.total !== 1) return null;

  return withDecryptedToken(parseStringify(bank.documents[0]));
}

// The Plaid account a bank document was linked to (an item can hold several)
const getLinkedAccount = async (bank: Bank) => {
  const accountsResponse = await plaidClient.accountsGet({
    access_token: bank.accessToken,
  });

  const accountData =
    accountsResponse.data.accounts.find((a) => a.account_id === bank.accountId)
    ?? accountsResponse.data.accounts[0];

  const institution = await getInstitution({
    institutionId: accountsResponse.data.item.institution_id!,
  });

  return {
    id: accountData.account_id,
    availableBalance: accountData.balances.available ?? 0,
    currentBalance: accountData.balances.current ?? 0,
    institutionId: institution.institution_id,
    name: accountData.name,
    officialName: accountData.official_name ?? "",
    mask: accountData.mask ?? "",
    type: accountData.type as string,
    subtype: (accountData.subtype ?? "") as string,
    appwriteItemId: bank.$id,
    shareableId: bank.shareableId,
  } satisfies Account;
};

// Get all bank accounts for a user
export const getAccounts = cache(async ({ userId }: getAccountsProps) => {
  const banks = await getBanks({ userId });

  const accounts = await Promise.all(banks.map(getLinkedAccount));

  const totalBanks = accounts.length;
  const totalCurrentBalance = accounts.reduce((total, account) => {
    return total + account.currentBalance;
  }, 0);

  return { data: accounts, totalBanks, totalCurrentBalance };
});

// Get one bank account with its transactions. Returns null when the bank does
// not exist or belongs to someone else.
export const getAccount = cache(async ({ appwriteItemId, userId }: getAccountProps) => {
  const bank = await getOwnedBank({ documentId: appwriteItemId, userId });

  if (!bank) return null;

  const [account, transferTransactionsData, transactions] = await Promise.all([
    getLinkedAccount(bank),
    getTransactionsByBankId({ bankId: bank.$id }),
    getTransactions({ accessToken: bank.accessToken, accountId: bank.accountId }),
  ]);

  // Transfers made through Dwolla are recorded in Appwrite
  const transferTransactions: Transaction[] = transferTransactionsData.documents.map(
    (transferData: Transaction) => ({
      id: transferData.$id,
      name: transferData.name,
      amount: Number(transferData.amount),
      date: transferData.$createdAt,
      paymentChannel: transferData.channel,
      category: transferData.category,
      pending: false,
      type: transferData.senderBankId === bank.$id ? "debit" : "credit",
    }) as Transaction
  );

  // sort transactions by date such that the most recent transaction is first
  const allTransactions = [...transactions, ...transferTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return {
    data: account,
    transactions: allTransactions,
  };
});

// Get bank info
export const getInstitution = async ({
  institutionId,
}: getInstitutionProps) => {
  const institutionResponse = await plaidClient.institutionsGetById({
    institution_id: institutionId,
    country_codes: ["US"] as CountryCode[],
  });

  return parseStringify(institutionResponse.data.institution);
};

// "FOOD_AND_DRINK" -> "Food and Drink"
const formatPlaidCategory = (category: string) =>
  category
    .toLowerCase()
    .split("_")
    .map((word, i) => (i > 0 && word === "and" ? word : word[0].toUpperCase() + word.slice(1)))
    .join(" ");

const toTransaction = (transaction: PlaidTransaction): Transaction => ({
  id: transaction.transaction_id,
  name: transaction.name,
  paymentChannel: transaction.payment_channel,
  // Plaid amounts are positive when money leaves the account
  type: transaction.amount > 0 ? "debit" : "credit",
  accountId: transaction.account_id,
  amount: Math.abs(transaction.amount),
  pending: transaction.pending,
  category: transaction.category?.[0]
    ?? (transaction.personal_finance_category ? formatPlaidCategory(transaction.personal_finance_category.primary) : "Other"),
  date: transaction.date,
  image: transaction.logo_url ?? "",
}) as Transaction;

// Get the Plaid transactions for one account
export const getTransactions = async ({
  accessToken,
  accountId,
}: getTransactionsProps) => {
  let hasMore = true;
  let cursor: string | undefined;
  const transactions: Transaction[] = [];

  // Iterate through each page of new transaction updates for item
  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    const data = response.data;

    transactions.push(
      ...data.added
        .filter((transaction) => !accountId || transaction.account_id === accountId)
        .map(toTransaction)
    );

    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  return transactions;
};
