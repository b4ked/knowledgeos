import type { NextAuthConfig } from "next-auth"

// Edge-compatible auth config — no Node.js-only imports (DB, bcrypt, etc.)
// Used by middleware for JWT verification only.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.plan = (user as { plan?: string }).plan ?? "free"
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as { plan?: string }).plan = token.plan as string
        ;(session.user as { isAdmin?: boolean }).isAdmin = Boolean(token.isAdmin)
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
}
