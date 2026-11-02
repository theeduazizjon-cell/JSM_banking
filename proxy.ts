import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/my-banks', '/payment-transfer', '/transaction-history', '/settings']

const isProtected = (pathname: string) =>
  pathname === '/' || PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

// A fresh nonce per request lets Next.js's own scripts run while blocking any
// injected ones. 'strict-dynamic' also allows scripts those trusted scripts
// load, such as Plaid Link's loader. Styles allow inline because React and
// the UI library render style attributes; injected styles can't run code.
const buildCsp = (nonce: string, https: boolean) => {
  const isDev = process.env.NODE_ENV === 'development'

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Sentry is reached through the /monitoring tunnel; the direct host is a fallback
    `connect-src 'self' https://*.sentry.io${isDev ? ' ws:' : ''}`,
    'frame-src https://cdn.plaid.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

export function proxy(request: NextRequest) {
  // Optimistic check only: sends visitors without a session cookie to sign-in
  // before any data is fetched. The real authorization happens on the server in
  // requireUser() and in every server action, since a cookie can be stale.
  if (isProtected(request.nextUrl.pathname) && !request.cookies.get('appwrite-session')?.value) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const https = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  const csp = buildCsp(nonce, https)

  // Next.js reads the nonce from the request's CSP header while rendering
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)

  return response
}

export const config = {
  matcher: [
    // Every page, but not static files, the Sentry tunnel or files with an extension
    '/((?!_next/static|_next/image|monitoring|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}
