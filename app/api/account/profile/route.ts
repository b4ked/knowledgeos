import { auth } from "@/auth"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name } = await req.json()

  await db
    .update(users)
    .set({ name: name?.trim() || null, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ message: "Profile updated" })
}
