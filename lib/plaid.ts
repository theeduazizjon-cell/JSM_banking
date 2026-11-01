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

// Plaid's SDK throws Axios errors that carry the full request config,
// including the PLAID-SECRET header. Logging one (or letting Next log it)
// writes the secret to the logs, so every call rethrows this instead.
export class PlaidRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly displayMessage: string | null,
  ) {
    super(`Plaid ${code}: ${message}`);
    this.name = 'PlaidRequestError';
  }
}

type PlaidErrorBody = { error_code?: string; error_message?: string; display_message?: string | null };

const toSafeError = (error: unknown) => {
  const body = (error as { response?: { data?: PlaidErrorBody } })?.response?.data;

  if (body?.error_code) {
    return new PlaidRequestError(body.error_code, body.error_message ?? 'Unknown error', body.display_message ?? null);
  }

  return new Error(`Plaid request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
};

const api = new PlaidApi(configuration);

export const plaidClient = new Proxy(api, {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);

    if (typeof value !== 'function') return value;

    return async (...args: unknown[]) => {
      try {
        return await value.apply(target, args);
      } catch (error) {
        throw toSafeError(error);
      }
    };
  },
});

// A message that is safe and useful to show the user
export const getPlaidErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof PlaidRequestError) {
    return error.displayMessage ?? `${fallback} (Plaid error ${error.code})`;
  }

  return fallback;
};
