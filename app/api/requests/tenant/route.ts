import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 获取租客的搜索需求历史
 */
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {
      tenantId: user.userId
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const requests = await prisma.tenantRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ requests })
  } catch (error: any) {
    console.error('Get tenant requests error:', error)
    return NextResponse.json(
      { error: 'Failed to get tenant requests', details: error.message },
      { status: 500 }
    )
  }
}
