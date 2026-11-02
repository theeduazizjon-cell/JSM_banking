'use server';

// Every export in this file is a public endpoint that any browser can call
// with any arguments. Identity therefore always comes from the session cookie,
// never from a parameter, and inputs are validated here as well as in the form.

import { AppwriteException, ID } from "node-appwrite";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { createAdminClient, createSessionClient, SESSION_COOKIE } from "../appwrite";
import { addFundingSource, createDwollaCustomer, DwollaRequestError } from "../dwolla";
import { getPlaidErrorMessage, plaidClient } from '../plaid';
import { authFormSchema, changePasswordSchema, extractCustomerIdFromUrl, parseStringify, toShareableId } from "../utils";
import { createBankAccount } from "../data/bank";
import { getCurrentUser, toPublicUser } from "../data/user";
import { createRateLimiter, getClientIp, tooManyAttempts } from "../rate-limit";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
} = process.env;

// Server action errors are swallowed before reaching the client,
// so return a readable message for the form to display instead.
const getErrorMessage = (error: unknown) => {
  if (!process.env.NEXT_PUBLIC_APPWRITE_PROJECT || !process.env.NEXT_APPWRITE_KEY) {
    return 'Appwrite is not configured. Add your project ID and API key to .env.local and restart the dev server.';
  }

  if (error instanceof DwollaRequestError && (!process.env.DWOLLA_KEY || !process.env.DWOLLA_SECRET)) {
    return 'Dwolla is not configured. Add DWOLLA_KEY and DWOLLA_SECRET to .env.local and restart the dev server.';
  }

  // Appwrite's and Dwolla's own messages are written for end users; anything
  // else (network failures, bugs) could expose internals.
  if (error instanceof AppwriteException || error instanceof DwollaRequestError) return error.message;

  return 'Something went wrong. Please try again.';
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Failed sign-ins per email address, and all sign-in attempts per IP
const signInFailures = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });
const signInAttempts = createRateLimiter({ limit: 30, windowMs: FIFTEEN_MINUTES });
// Each sign-up creates a Dwolla customer, so keep them rare per IP
const signUpAttempts = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
// Wrong current passwords per user
const passwordFailures = createRateLimiter({ limit: 5, windowMs: FIFTEEN_MINUTES });

const setSessionCookie = async (secret: string) => {
  (await cookies()).set(SESSION_COOKIE, secret, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: true,
  });
}

export const signIn = async ({ email, password }: signInProps): Promise<ActionResult> => {
  const parsed = authFormSchema('sign-in').safeParse({ email, password });

  if (!parsed.success) return { ok: false, error: 'Enter a valid email and a password of at least 8 characters.' };

  const emailKey = email.trim().toLowerCase();
  const ip = await getClientIp();
  const limit = [signInFailures.check(emailKey), signInAttempts.check(ip)].find((l) => l.limited);

  if (limit?.limited) return { ok: false, error: tooManyAttempts(limit.retryAfterSeconds) };

  signInAttempts.hit(ip);

  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    await setSessionCookie(session.secret);
    signInFailures.reset(emailKey);

    return { ok: true };
  } catch (error) {
    // Only wrong passwords count towards the lockout, not outages
    if (error instanceof AppwriteException && error.code === 401) signInFailures.hit(emailKey);
    console.error('Sign in failed:', error instanceof Error ? error.message : error);
    return { ok: false, error: getErrorMessage(error) };
  }
}

export const signUp = async (params: SignUpParams): Promise<ActionResult<PublicUser>> => {
  const parsed = authFormSchema('sign-up').safeParse(params);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check your details and try again.' };
  }

  const ip = await getClientIp();
  const limit = signUpAttempts.check(ip);

  if (limit.limited) return { ok: false, error: tooManyAttempts(limit.retryAfterSeconds) };

  signUpAttempts.hit(ip);

  // The SSN is only forwarded to Dwolla for identity verification; it is never stored.
  const { password, ssn, ...profile } = params;
  const { email, firstName, lastName } = profile;

  let newUserAccount;

  try {
    const { account, database } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(),
      email,
      password,
      `${firstName} ${lastName}`
    );

    if(!newUserAccount) throw new Error('Error creating user')

    const dwollaCustomerUrl = await createDwollaCustomer({
      ...profile,
      ssn,
      type: 'personal'
    })

    if(!dwollaCustomerUrl) throw new DwollaRequestError('Dwolla could not verify these details. Please check them and try again.')

    const dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);

    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        ...profile,
        userId: newUserAccount.$id,
        dwollaCustomerId,
        dwollaCustomerUrl
      }
    )

    const session = await account.createEmailPasswordSession(email, password);

    await setSessionCookie(session.secret);

    return { ok: true, data: toPublicUser(parseStringify(newUser)) };
  } catch (error) {
    console.error('Sign up failed:', error instanceof Error ? error.message : error);

    // Remove the half-created login so the same email can sign up again
    if (newUserAccount) {
      try {
        const { user } = await createAdminClient();
        await user.delete(newUserAccount.$id);
      } catch (cleanupError) {
        console.error('Error removing incomplete user', cleanupError);
      }
    }

    return { ok: false, error: getErrorMessage(error) };
  }
}

export const logoutAccount = async (): Promise<ActionResult> => {
  try {
    const { account } = await createSessionClient();
    await account.deleteSession('current');
  } catch {
    // The session may already be expired; clearing the cookie is enough
  }

  (await cookies()).delete(SESSION_COOKIE);

  return { ok: true };
}

export const createLinkToken = async (): Promise<ActionResult<{ linkToken: string }>> => {
  const user = await getCurrentUser();

  if (!user) return { ok: false, error: 'You need to be signed in to connect a bank.' };

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: user.$id
      },
      client_name: `${user.firstName} ${user.lastName}`,
      products: ['auth'] as Products[],
      language: 'en',
      country_codes: ['US'] as CountryCode[],
    });

    return { ok: true, data: { linkToken: response.data.link_token } };
  } catch (error) {
    console.error('Creating a Plaid link token failed:', error instanceof Error ? error.message : error);
    return { ok: false, error: getPlaidErrorMessage(error, 'Could not start bank linking. Please try again.') };
  }
}

export const exchangePublicToken = async ({
  publicToken,
}: exchangePublicTokenProps): Promise<ActionResult> => {
  const user = await getCurrentUser();

  if (!user) return { ok: false, error: 'You need to be signed in to connect a bank.' };

  try {
    // Exchange public token for access token and item ID
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get account information from Plaid using the access token
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountsResponse.data.accounts[0];

    // Create a processor token for Dwolla using the access token and account ID
    const request: ProcessorTokenCreateRequest = {
      access_token: accessToken,
      account_id: accountData.account_id,
      processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
    };

    const processorTokenResponse = await plaidClient.processorTokenCreate(request);
    const processorToken = processorTokenResponse.data.processor_token;

    // Create a funding source URL for the account using the Dwolla customer ID, processor token, and bank name
    const fundingSourceUrl = await addFundingSource({
      dwollaCustomerId: user.dwollaCustomerId,
      processorToken,
      bankName: accountData.name,
    });

    if (!fundingSourceUrl) throw new Error('Dwolla could not add this bank as a funding source.');

    await createBankAccount({
      userId: user.$id,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl,
      shareableId: toShareableId(accountData.account_id),
    });

    revalidatePath("/", "layout");

    return { ok: true };
  } catch (error) {
    console.error("An error occurred while exchanging the public token:", error instanceof Error ? error.message : error);
    return { ok: false, error: getPlaidErrorMessage(error, 'Could not connect this bank. Please try again.') };
  }
}

export const changePassword = async (input: ChangePasswordValues): Promise<ActionResult> => {
  const parsed = changePasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  }

  const user = await getCurrentUser();

  if (!user) return { ok: false, error: 'Your session has expired. Please sign in again.' };

  const limit = passwordFailures.check(user.$id);

  if (limit.limited) return { ok: false, error: tooManyAttempts(limit.retryAfterSeconds) };

  try {
    // The session client acts as the signed-in user, and Appwrite checks the
    // old password itself before accepting the new one.
    const { account } = await createSessionClient();
    await account.updatePassword({ password: parsed.data.newPassword, oldPassword: parsed.data.currentPassword });

    return { ok: true };
  } catch (error) {
    const type = (error as { type?: string })?.type;
    console.error('Password change failed:', type ?? (error instanceof Error ? error.message : error));

    if (type === 'user_invalid_credentials') {
      passwordFailures.hit(user.$id);
      return { ok: false, error: 'Your current password is incorrect.' };
    }
    if (type === 'user_password_recently_used') return { ok: false, error: 'Choose a password you have not used recently.' };
    if (error instanceof Error && error.message === 'No session') {
      return { ok: false, error: 'Your session has expired. Please sign in again.' };
    }

    return { ok: false, error: 'Could not change your password. Please try again.' };
  }
}
