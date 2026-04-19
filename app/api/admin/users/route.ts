import { requireAdmin } from '@/lib/admin/requireAdmin'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      plan: users.plan,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  return Response.json({ users: rows })
}
