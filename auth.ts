import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import { authConfig } from "./auth.config"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // GitHub OAuth — requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET env vars
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials as { email: string; password: string }
        if (!email || !password) return null

        const user = await db.query.users.findFirst({
          where: eq(users.email, email.toLowerCase().trim()),
        })
        if (!user || !user.hashedPassword) return null

        const valid = await bcrypt.compare(password, user.hashedPassword)
        if (!valid) return null

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // For OAuth providers (GitHub), auto-create or link user in DB
      if (account?.provider === "github" && user.email) {
        const existing = await db.query.users.findFirst({
          where: eq(users.email, user.email.toLowerCase()),
        })
        if (!existing) {
          const [created] = await db
            .insert(users)
            .values({
              email: user.email.toLowerCase(),
              name: user.name ?? null,
              emailVerified: true, // GitHub verifies email
              plan: "free",
            })
            .returning()
          user.id = created.id
          ;(user as { plan?: string }).plan = "free"
        } else {
          user.id = existing.id
          ;(user as { plan?: string }).plan = existing.plan
        }
      }
      return true
    },
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
})
