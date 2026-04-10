import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import { userPreferences } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const prefs = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, session.user.id),
  })

  return NextResponse.json({
    vaultMode: prefs?.vaultMode ?? "cloud",
    llmProvider: prefs?.llmProvider ?? "openai",
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json() as { vaultMode?: string; llmProvider?: string }
  const userId = session.user.id

  const existing = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  })

  if (existing) {
    await db
      .update(userPreferences)
      .set({
        ...(body.vaultMode !== undefined && { vaultMode: body.vaultMode }),
        ...(body.llmProvider !== undefined && { llmProvider: body.llmProvider }),
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
  } else {
    await db.insert(userPreferences).values({
      userId,
      vaultMode: body.vaultMode ?? "cloud",
      llmProvider: body.llmProvider ?? "openai",
    })
  }

  return NextResponse.json({ ok: true })
}
