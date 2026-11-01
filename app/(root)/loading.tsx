// Shown while account balances and transactions load from Plaid
export default function Loading() {
  return (
    <section className="flex size-full flex-col gap-8 px-5 py-7 sm:px-8 lg:py-12 xl:max-h-screen" aria-busy="true" aria-label="Loading your accounts">
      <div className="flex flex-col gap-3">
        <div className="h-8 w-64 animate-pulse rounded-md bg-gray-200" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-gray-100" />
      </div>
      <div className="h-44 w-full animate-pulse rounded-xl bg-gray-100" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    </section>
  )
}
