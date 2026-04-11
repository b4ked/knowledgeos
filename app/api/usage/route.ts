import { auth } from '@/auth'
import { getDailyUsage } from '@/lib/usage'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ plan: 'guest', used: 0, limit: 0 })
  }

  const usage = await getDailyUsage(session.user.id)
  return Response.json(usage)
}
