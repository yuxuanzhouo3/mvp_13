import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { payoutAccountId } = body

    if (!payoutAccountId) {
      return NextResponse.json({ error: 'Payout Account ID is required' }, { status: 400 })
    }

    const region = getAppRegion()
    
    if (region === 'china') {
      const db = getDatabaseAdapter()
      const landlordProfile = await db.query('landlordProfiles', { userId: user.userId })
      
      if (landlordProfile && landlordProfile.length > 0) {
        await db.update('landlordProfiles', landlordProfile[0].id, { payoutAccountId })
      } else {
        await db.create('landlordProfiles', {
          userId: user.userId,
          payoutAccountId,
          verified: true // Assume verified for mock
        })
      }
    } else {
      // Global - use Prisma
      await prisma.landlordProfile.upsert({
        where: { userId: user.userId },
        update: { payoutAccountId, verified: true },
        create: {
          userId: user.userId,
          payoutAccountId,
          verified: true
        }
      })
    }

    return NextResponse.json({ success: true, payoutAccountId })
  } catch (error: any) {
    console.error('Update payout settings error:', error)
    return NextResponse.json(
      { error: 'Failed to update payout settings', details: error.message },
      { status: 500 }
    )
  }
}
