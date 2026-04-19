import { requireAdmin } from '@/lib/admin/requireAdmin'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const ALLOWED_PLANS = new Set(['free', 'pro', 'team', 'enterprise'])

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const { id } = await params
  const body = await request.json() as { plan?: string; isAdmin?: boolean }

  const updates: {
    plan?: string
    isAdmin?: boolean
    updatedAt: Date
  } = {
    updatedAt: new Date(),
  }

  if (typeof body.plan === 'string' && ALLOWED_PLANS.has(body.plan)) {
    updates.plan = body.plan
  }
  if (typeof body.isAdmin === 'boolean') {
    updates.isAdmin = body.isAdmin
  }

  if (Object.keys(updates).length === 1) {
    return Response.json({ error: 'No valid update fields provided' }, { status: 400 })
  }

  await db.update(users).set(updates).where(eq(users.id, id))
  const updated = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      plan: true,
      isAdmin: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!updated) return Response.json({ error: 'User not found' }, { status: 404 })
  return Response.json({ ok: true, user: updated })
}
