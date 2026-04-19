import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false as const, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, isAdmin: true, email: true },
  })
  if (!user?.isAdmin) {
    return { ok: false as const, response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true as const, user }
}
