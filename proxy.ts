import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const protectedRoutes = ["/billing", "/usage", "/account"]
const authOnlyRoutes = ["/login", "/signup", "/forgot-password"]
const sessionCookiePrefixes = ["authjs.session-token", "__Secure-authjs.session-token"]

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) =>
    sessionCookiePrefixes.some((prefix) => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`))
  )
}

export default function proxy(request: NextRequest) {
  const isLoggedIn = hasSessionCookie(request)
  const { pathname } = request.nextUrl

  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (authOnlyRoutes.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/billing/:path*",
    "/usage/:path*",
    "/account/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
}
