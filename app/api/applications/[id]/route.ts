import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { trackEvent } from '@/lib/analytics'

/**
 * 更新申请状态
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status } = body

    const db = getDatabaseAdapter()
    const application = await db.findById('applications', params.id)

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // 获取房源信息
    const property = await db.findById('properties', application.propertyId)
    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 只有房东可以审核申请
    if (property.landlordId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this application' },
        { status: 403 }
      )
    }

    const updatedApplication = await db.update('applications', params.id, {
      status: status,
      reviewedDate: new Date(),
    })

    // 加载关联数据
    const tenant = await db.findUserById(application.tenantId)
    const applicationWithRelations = {
      ...updatedApplication,
      property,
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
      } : null,
    }

    // 埋点
    await trackEvent({
      type: 'APPLICATION_SUBMIT',
      userId: application.tenantId,
      metadata: {
        applicationId: params.id,
        status,
        propertyId: application.propertyId,
      },
    })

    // 如果申请被批准，可以创建租赁合同
    if (status === 'APPROVED') {
      // 可选：自动创建租赁合同
    }

    return NextResponse.json({ application: applicationWithRelations })
  } catch (error: any) {
    console.error('Update application error:', error)
    return NextResponse.json(
      { error: 'Failed to update application', details: error.message },
      { status: 500 }
    )
  }
}
