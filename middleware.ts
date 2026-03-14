import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_ADMIN_PATHS = ['/admin/unauthorized']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /admin/* routes (except the public ones above)
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Let these through without a JWT
  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // /admin/login and /admin/verify are API routes — never block them here
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/verify')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('admin_token')?.value

  if (!token) {
    // No cookie → show the login page (which is /admin itself)
    // Avoid redirect loop: if already on /admin, let it render the login UI
    if (pathname === '/admin') {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    // Invalid or expired JWT → clear cookie and redirect to /admin
    const res = NextResponse.redirect(new URL('/admin', req.url))
    res.cookies.delete('admin_token')
    return res
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
