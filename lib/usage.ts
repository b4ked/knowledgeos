import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, dailyUsage } from '@/lib/db/schema'

export const FREE_DAILY_LIMIT = 10

export type UsageAction = 'compile' | 'chat'

function todayUTC(): string {
  return new Date().toISOString().split('T')[0]
}

export interface UsageResult {
  allowed: boolean
  used: number
  limit: number
}

export async function checkAndIncrementUsage(
  userId: string,
  action: UsageAction,
): Promise<UsageResult> {
  const userRows = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const plan = userRows[0]?.plan ?? 'free'

  // Non-free plans are unlimited
  if (plan !== 'free') {
    return { allowed: true, used: 0, limit: -1 }
  }

  const today = todayUTC()

  const rows = await db
    .select()
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, today)))
    .limit(1)

  const row = rows[0]
  const used = row ? row.compileCount + row.chatCount : 0

  if (used >= FREE_DAILY_LIMIT) {
    return { allowed: false, used, limit: FREE_DAILY_LIMIT }
  }

  if (row) {
    await db
      .update(dailyUsage)
      .set({
        compileCount: action === 'compile' ? row.compileCount + 1 : row.compileCount,
        chatCount: action === 'chat' ? row.chatCount + 1 : row.chatCount,
        updatedAt: new Date(),
      })
      .where(eq(dailyUsage.id, row.id))
  } else {
    await db.insert(dailyUsage).values({
      userId,
      date: today,
      compileCount: action === 'compile' ? 1 : 0,
      chatCount: action === 'chat' ? 1 : 0,
    })
  }

  return { allowed: true, used: used + 1, limit: FREE_DAILY_LIMIT }
}

export async function getDailyUsage(userId: string): Promise<UsageResult> {
  const userRows = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const plan = userRows[0]?.plan ?? 'free'

  if (plan !== 'free') {
    return { allowed: true, used: 0, limit: -1 }
  }

  const today = todayUTC()
  const rows = await db
    .select()
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.date, today)))
    .limit(1)

  const row = rows[0]
  const used = row ? row.compileCount + row.chatCount : 0
  return { allowed: used < FREE_DAILY_LIMIT, used, limit: FREE_DAILY_LIMIT }
}
