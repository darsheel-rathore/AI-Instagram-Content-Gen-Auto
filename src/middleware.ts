import { clerkMiddleware, createRouteMatcher, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// /login and /unauthorized are public — no auth or role check.
// /api/keepalive is also public: an external scheduler pings it unauthenticated
// to keep the Upstash free-tier database from being auto-deleted after 14 days
// of inactivity (see src/app/api/keepalive/route.ts).
const isPublicRoute = createRouteMatcher(['/login(.*)', '/unauthorized', '/api/keepalive'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  // Step 1 — must be signed in (redirects to /login if not)
  await auth.protect()

  // Step 2 — must have role: "admin" in publicMetadata
  const { userId } = await auth()
  const client = await clerkClient()
  const user = await client.users.getUser(userId!)

  if (user.publicMetadata?.role !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)',
    '/(api|trpc)(.*)',
  ],
}
