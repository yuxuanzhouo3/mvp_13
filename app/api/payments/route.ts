import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

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

    const db = getDatabaseAdapter()
    const dbUser = await db.findUserById(user.id)

    let payments = await db.query('payments', {})
    
    // 应用过滤
    if (dbUser?.userType === 'TENANT') {
      // Tenants see their own payments
      payments = payments.filter((p: any) => p.userId === user.id)
    } else if (dbUser?.userType === 'LANDLORD') {
      // Landlords see payments for their properties
      const properties = await db.query('properties', { landlordId: user.id })
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
        const [property, paymentUser] = await Promise.all([
          payment.propertyId ? db.findById('properties', payment.propertyId) : null,
          db.findUserById(payment.userId),
        ])
        return {
          ...payment,
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

    return NextResponse.json({ payments: paymentsWithRelations })
  } catch (error: any) {
    console.error('Get payments error:', error)
    return NextResponse.json(
      { error: 'Failed to get payments', details: error.message },
      { status: 500 }
    )
  }
}
