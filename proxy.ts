import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const protectedRoutes = ["/billing", "/usage", "/account"]
  const authOnlyRoutes = ["/login", "/signup", "/forgot-password"]

  if (protectedRoutes.some((r) => pathname.startsWith(r)) && !isLoggedIn) {
    const loginUrl = new URL(req.nextUrl.origin + "/login")
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (authOnlyRoutes.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL(req.nextUrl.origin + "/"))
  }

  return NextResponse.next()
})

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
