import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import AdminDashboard from './AdminDashboard'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const me = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { isAdmin: true, email: true },
  })
  if (!me?.isAdmin) redirect('/account')

  return <AdminDashboard />
}
