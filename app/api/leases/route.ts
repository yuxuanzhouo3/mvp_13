import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 获取租约列表
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

    // 获取所有租约
    let leases = await db.query('leases', {})
    
    // 根据用户类型过滤
    if (dbUser?.userType === 'TENANT') {
      // 租客看到自己的租约
      leases = leases.filter((l: any) => l.tenantId === user.id)
    } else if (dbUser?.userType === 'LANDLORD') {
      // 房东看到自己房源的租约
      const properties = await db.query('properties', { landlordId: user.id })
      const propertyIds = properties.map((p: any) => p.id)
      leases = leases.filter((l: any) => l.propertyId && propertyIds.includes(l.propertyId))
    }

    // 排序
    leases.sort((a: any, b: any) => {
      const dateA = new Date(a.startDate || a.createdAt).getTime()
      const dateB = new Date(b.startDate || b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载关联数据
    const leasesWithRelations = await Promise.all(
      leases.map(async (lease: any) => {
        let property = null
        let tenant = null
        let landlord = null
        
        try {
          if (lease.propertyId) {
            property = await db.findById('properties', lease.propertyId)
            if (property && property.landlordId) {
              landlord = await db.findUserById(property.landlordId)
            }
          }
        } catch (err) {
          console.warn('Failed to load property for lease:', lease.id, err)
        }
        
        try {
          if (lease.tenantId) {
            tenant = await db.findUserById(lease.tenantId)
          }
        } catch (err) {
          console.warn('Failed to load tenant for lease:', lease.id, err)
        }
        
        return {
          ...lease,
          property: property ? {
            id: property.id,
            title: property.title,
            address: property.address,
          } : null,
          tenant: tenant ? {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
          } : null,
          landlord: landlord ? {
            id: landlord.id,
            name: landlord.name,
            email: landlord.email,
          } : null,
        }
      })
    )

    return NextResponse.json({ leases: leasesWithRelations })
  } catch (error: any) {
    console.error('Get leases error:', error)
    return NextResponse.json(
      { error: 'Failed to get leases', details: error.message },
      { status: 500 }
    )
  }
}
