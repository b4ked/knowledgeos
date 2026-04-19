import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      plan: (session.user as { plan?: string }).plan ?? "free",
      isAdmin: Boolean((session.user as { isAdmin?: boolean }).isAdmin),
    },
  })
}
