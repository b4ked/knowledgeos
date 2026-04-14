import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { users, emailVerificationTokens } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { sendVerificationEmail } from "@/lib/email/send"

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const [user] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        hashedPassword,
        name: name?.trim() || null,
        emailVerified: false,
        plan: "free",
      })
      .returning()

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await db
      .update(emailVerificationTokens)
      .set({ used: true })
      .where(eq(emailVerificationTokens.userId, user.id))

    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      token,
      expiresAt,
    })

    try {
      await sendVerificationEmail({ email: normalizedEmail, name: user.name, token })
    } catch (emailErr) {
      console.error("Verification email failed:", emailErr)
      // Account created — email failed. Return success with a note.
      return NextResponse.json(
        { message: "Account created. We couldn't send a verification email right now — please contact support or try again later.", emailFailed: true },
        { status: 201 }
      )
    }

    return NextResponse.json(
      { message: "Account created. Check your email to verify your address." },
      { status: 201 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const cause = (err as any)?.cause
    const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : undefined
    const code = (err as any)?.code
    const detail = (err as any)?.detail
    console.error("Signup error:", { msg, causeMsg, code, detail, stack: err instanceof Error ? err.stack : undefined })
    return NextResponse.json({
      error: "Could not create account. Please try again.",
    }, { status: 500 })
  }
}
