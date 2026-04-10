import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, emailVerificationTokens } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { sendWelcomeEmail } from "@/lib/email/send"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  try {
    const record = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.token, token),
        eq(emailVerificationTokens.used, false)
      ),
    })

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 })
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: "Verification link has expired. Please sign up again." }, { status: 400 })
    }

    const [user] = await db
      .update(users)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(users.id, record.userId))
      .returning()

    await db
      .update(emailVerificationTokens)
      .set({ used: true })
      .where(eq(emailVerificationTokens.id, record.id))

    await sendWelcomeEmail({ email: user.email, name: user.name }).catch(() => {})

    return NextResponse.json({ message: "Email verified successfully" })
  } catch (err) {
    console.error("Verify email error:", err)
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 })
  }
}
