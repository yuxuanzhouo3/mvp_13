import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 更新申请状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status } = body

    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        property: true
      }
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 只有房东可以审核申请
    if (application.property.landlordId !== user.userId) {
      return NextResponse.json(
        { error: 'Not authorized to update this application' },
        { status: 403 }
      )
    }

    const updatedApplication = await prisma.application.update({
      where: { id: params.id },
      data: {
        status: status as any,
        reviewedDate: new Date()
      },
      include: {
        property: true,
        tenant: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // 如果申请被批准，可以创建租赁合同
    if (status === 'APPROVED') {
      // 可选：自动创建租赁合同
    }

    return NextResponse.json({ application: updatedApplication })
  } catch (error: any) {
    console.error('Update application error:', error)
    return NextResponse.json(
      { error: 'Failed to update application', details: error.message },
      { status: 500 }
    )
  }
}
