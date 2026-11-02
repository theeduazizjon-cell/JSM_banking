'use client' // Error boundaries must be Client Components

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

// Shown when a bank provider (Plaid, Dwolla) or Appwrite request fails while
// rendering a signed-in page, instead of a blank screen.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="flex size-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-24 font-semibold text-gray-900">We couldn&apos;t load your banking data</h2>
      <p className="text-16 max-w-md text-gray-600">
        One of our banking providers didn&apos;t respond. Your accounts are safe. Please try again in a moment.
      </p>
      {error.digest && (
        <p className="text-12 text-gray-500">Reference: {error.digest}</p>
      )}
      <Button onClick={() => retry()} className="form-btn px-6">
        Try again
      </Button>
    </section>
  )
}
