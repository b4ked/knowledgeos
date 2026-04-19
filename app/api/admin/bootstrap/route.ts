import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.isAdmin, true))

  const current = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { isAdmin: true, email: true },
  })

  if (!current) return Response.json({ error: 'User not found' }, { status: 404 })
  if (current.isAdmin) return Response.json({ ok: true, alreadyAdmin: true })
  if ((count ?? 0) > 0) return Response.json({ error: 'Admin already exists' }, { status: 403 })

  await db
    .update(users)
    .set({ isAdmin: true, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))

  return Response.json({ ok: true, promoted: true })
}
