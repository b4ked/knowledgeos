import { auth } from '@/auth'
import { getDailyUsage } from '@/lib/usage'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ plan: 'guest', used: 0, limit: 0 })
  }

  try {
    const usage = await getDailyUsage(session.user.id)
    return Response.json(usage)
  } catch {
    // Table may not exist yet — return empty so banner stays hidden
    return Response.json({ plan: 'free', used: 0, limit: 0 })
  }
}
