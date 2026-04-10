import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

// Edge-compatible auth config — no Node.js-only imports (DB, bcrypt, etc.)
// Used by middleware for JWT verification only.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [
    // Credentials provider needs to be listed for NextAuth to allow it,
    // but the real authorize() logic lives in auth.ts (Node.js runtime only).
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize() {
        return null
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.plan = (user as { plan?: string }).plan ?? "free"
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as { plan?: string }).plan = token.plan as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
}
