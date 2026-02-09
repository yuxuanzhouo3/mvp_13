import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'

/**
 * Get payments for current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const db = getDatabaseAdapter()
    let dbUser = null
    try {
      dbUser = await db.findUserById(user.id)
    } catch {}
    if (!dbUser && user.email) {
      try {
        dbUser = await db.findUserByEmail(user.email)
      } catch {}
    }
    const resolvedUserId = dbUser?.id || user.id

    let payments: any[] = []
    if (region === 'global') {
      payments = await prisma.payment.findMany({
        select: {
          id: true,
          userId: true,
          type: true,
          amount: true,
          status: true,
          description: true,
          propertyId: true,
          transactionId: true,
          paymentMethod: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } else {
      payments = await db.query('payments', {})
    }
    
    console.log('Payments API - Total payments found:', payments.length, 'User ID:', resolvedUserId, 'UserType:', dbUser?.userType)
    
    // 应用过滤
    if (dbUser?.userType === 'TENANT') {
      // Tenants see their own payments
      const beforeFilter = payments.length
      payments = payments.filter((p: any) => p.userId === resolvedUserId)
      console.log('Payments API - After tenant filter:', payments.length, 'from', beforeFilter)
    } else if (dbUser?.userType === 'LANDLORD') {
      // Landlords see payments for their properties
      const properties = region === 'global'
        ? await prisma.property.findMany({
            where: { landlordId: resolvedUserId },
            select: { id: true },
          })
        : await db.query('properties', { landlordId: resolvedUserId })
      const propertyIds = properties.map((p: any) => p.id)
      payments = payments.filter((p: any) => p.propertyId && propertyIds.includes(p.propertyId))
    }

    // 排序
    payments.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载关联数据
    const paymentsWithRelations = await Promise.all(
      payments.map(async (payment: any) => {
        let property = null
        let paymentUser = null
        
        try {
          if (payment.propertyId) {
            property = region === 'global'
              ? await prisma.property.findUnique({
                  where: { id: payment.propertyId },
                  select: { id: true, title: true, address: true },
                })
              : await db.findById('properties', payment.propertyId)
          }
        } catch (err) {
          console.warn('Failed to load property for payment:', payment.id, err)
        }
        
        try {
          paymentUser = region === 'global'
            ? await prisma.user.findUnique({
                where: { id: payment.userId },
                select: { id: true, name: true, email: true },
              })
            : await db.findUserById(payment.userId)
        } catch (err) {
          console.warn('Failed to load user for payment:', payment.id, err)
        }
        
        // 确保metadata是对象格式
        let metadata = payment.metadata
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata)
          } catch {
            metadata = {}
          }
        }
        
        return {
          ...payment,
          metadata: metadata || {},
          property: property ? {
            id: property.id,
            title: property.title,
            address: property.address,
          } : null,
          user: paymentUser ? {
            id: paymentUser.id,
            name: paymentUser.name,
            email: paymentUser.email,
          } : null,
        }
      })
    )

    console.log('Payments API - Returning payments:', paymentsWithRelations.length)
    return NextResponse.json({ payments: paymentsWithRelations })
  } catch (error: any) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { error: 'Failed to get payments', details: error.message },
      { status: 500 }
    )
  }
}
