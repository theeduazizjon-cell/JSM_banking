import "server-only";

import { cache } from "react";
import { Query } from "node-appwrite";
import { redirect } from "next/navigation";
import { createAdminClient, createSessionClient } from "../appwrite";
import { parseStringify } from "../utils";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps): Promise<User | undefined> => {
  const { database } = await createAdminClient();

  const user = await database.listDocuments(
    DATABASE_ID!,
    USER_COLLECTION_ID!,
    [Query.equal('userId', [userId])]
  )

  return parseStringify(user.documents[0]);
}

// The full user document for the current session, or null when signed out.
// Server-side only: it holds Dwolla IDs and address details, so pass
// `toPublicUser(user)` to anything rendered on the client.
// Wrapped in cache() so the layout and page share one lookup per request.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  let accountId: string;

  try {
    const { account } = await createSessionClient();
    accountId = (await account.get()).$id;
  } catch {
    // No cookie, or an expired/revoked session
    return null;
  }

  return (await getUserInfo({ userId: accountId })) ?? null;
});

export const requireUser = async (): Promise<User> => {
  const user = await getCurrentUser();

  if (!user) redirect('/sign-in');

  return user;
}

export const toPublicUser = (user: User): PublicUser => ({
  $id: user.$id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
});
