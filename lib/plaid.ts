import "server-only";

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Only sandbox and production exist in Plaid's API; default to sandbox so a
// missing variable can never point the app at real bank data.
const plaidEnv = process.env.PLAID_ENV === 'production' ? 'production' : 'sandbox';

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    }
  }
})

export const plaidClient = new PlaidApi(configuration);
