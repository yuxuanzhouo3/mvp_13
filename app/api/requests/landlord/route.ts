import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 获取房东的搜索需求历史
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {
      landlordId: user.userId
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const requests = await prisma.landlordRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ requests })
  } catch (error: any) {
    console.error('Get landlord requests error:', error)
    return NextResponse.json(
      { error: 'Failed to get landlord requests', details: error.message },
      { status: 500 }
    )
  }
}
