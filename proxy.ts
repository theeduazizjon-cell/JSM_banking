import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Optimistic check only: sends visitors without a session cookie to sign-in
// before any data is fetched. The real authorization happens on the server in
// requireUser() and in every server action, since a cookie can be stale.
export function proxy(request: NextRequest) {
  if (!request.cookies.get('appwrite-session')?.value) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/my-banks/:path*', '/payment-transfer/:path*', '/transaction-history/:path*', '/settings/:path*'],
}
