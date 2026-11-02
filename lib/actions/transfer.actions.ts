'use server';

import { revalidatePath } from "next/cache";

import { createTransfer, DwollaRequestError } from "../dwolla";
import { fromShareableId, transferFormSchema } from "../utils";
import { getBankByAccountId, getBankOwnerId, getOwnedBank } from "../data/bank";
import { createTransaction } from "../data/transaction";
import { getCurrentUser } from "../data/user";
import { createRateLimiter, tooManyAttempts } from "../rate-limit";

// Transfers per user, so a script with a valid session can't flood Dwolla
const transferAttempts = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

// Sends money from one of the signed-in user's banks to the bank behind a
// shareable ID. Runs entirely on the server: the browser only supplies what
// the user typed, and ownership of the source bank is checked here.
export const transferFunds = async (input: TransferFormValues): Promise<ActionResult> => {
  const user = await getCurrentUser();

  if (!user) return { ok: false, error: 'Your session has expired. Please sign in again.' };

  const parsed = transferFormSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Please check the transfer details.' };
  }

  const { senderBank: senderBankId, sharableId, amount, email, name } = parsed.data;

  try {
    const senderBank = await getOwnedBank({ documentId: senderBankId, userId: user.$id });

    if (!senderBank) return { ok: false, error: 'Select one of your own bank accounts to send from.' };

    const receiverAccountId = fromShareableId(sharableId);
    const receiverBank = receiverAccountId ? await getBankByAccountId({ accountId: receiverAccountId }) : null;

    if (!receiverBank) return { ok: false, error: 'No account matches that shareable ID.' };

    if (receiverBank.$id === senderBank.$id) {
      return { ok: false, error: 'Choose a different account to send to.' };
    }

    const limit = transferAttempts.check(user.$id);

    if (limit.limited) return { ok: false, error: tooManyAttempts(limit.retryAfterSeconds) };

    transferAttempts.hit(user.$id);

    const value = Number(amount).toFixed(2);

    const transferUrl = await createTransfer({
      sourceFundingSourceUrl: senderBank.fundingSourceUrl,
      destinationFundingSourceUrl: receiverBank.fundingSourceUrl,
      amount: value,
    });

    try {
      await createTransaction({
        name: name || 'Transfer',
        amount: value,
        senderId: user.$id,
        senderBankId: senderBank.$id,
        receiverId: getBankOwnerId(receiverBank)!,
        receiverBankId: receiverBank.$id,
        email,
      });
    } catch (error) {
      // The money has already moved. Say so plainly, so the user doesn't send
      // it again, and log the Dwolla transfer for reconciliation.
      console.error('Transfer sent but not recorded:', transferUrl, error instanceof Error ? error.message : error);
      revalidatePath('/', 'layout');
      return { ok: false, error: 'The transfer was sent, but it could not be added to your history yet. Please don\'t send it again.' };
    }

    revalidatePath('/', 'layout');

    return { ok: true };
  } catch (error) {
    console.error('Transfer failed:', error instanceof Error ? error.message : error);
    // Only Dwolla's own validation messages are meant for users
    return { ok: false, error: error instanceof DwollaRequestError ? error.message : 'The transfer could not be completed. Please try again.' };
  }
}
