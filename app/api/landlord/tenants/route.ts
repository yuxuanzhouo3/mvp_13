import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * Get tenants for landlord (approved applications and active leases)
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

    // Get landlord's properties
    const properties = await prisma.property.findMany({
      where: { landlordId: user.userId },
      select: { id: true, title: true }
    })

    const propertyIds = properties.map(p => p.id)

    // Get approved applications for these properties
    const approvedApplications = await prisma.application.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: 'APPROVED'
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        property: {
          select: {
            id: true,
            title: true,
            address: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    // Get active leases
    const activeLeases = await prisma.lease.findMany({
      where: {
        landlordId: user.userId,
        status: 'ACTIVE'
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true
          }
        }
      }
    })

    // Fetch tenant info for leases
    const tenantsFromLeases = await Promise.all(
      activeLeases.map(async (lease) => {
        const tenant = await prisma.user.findUnique({
          where: { id: lease.tenantId },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        })
        return {
          ...tenant,
          propertyId: lease.property?.id,
          propertyName: lease.property?.title,
          propertyAddress: lease.property?.address,
          leaseStart: lease.startDate,
          leaseEnd: lease.endDate,
          monthlyRent: lease.monthlyRent,
          source: 'lease'
        }
      })
    )

    // Combine and deduplicate tenants
    const tenantsFromApplications = approvedApplications.map(app => ({
      id: app.tenant.id,
      name: app.tenant.name,
      email: app.tenant.email,
      phone: app.tenant.phone,
      propertyId: app.property?.id,
      propertyName: app.property?.title,
      propertyAddress: app.property?.address,
      applicationDate: app.appliedDate,
      source: 'application'
    }))

    // Deduplicate by tenant ID
    const tenantMap = new Map()
    tenantsFromLeases.forEach(t => {
      if (t?.id) tenantMap.set(t.id, t)
    })
    tenantsFromApplications.forEach(t => {
      if (!tenantMap.has(t.id)) {
        tenantMap.set(t.id, t)
      }
    })

    const tenants = Array.from(tenantMap.values())

    return NextResponse.json({ tenants })
  } catch (error: any) {
    console.error('Get landlord tenants error:', error)
    return NextResponse.json(
      { error: 'Failed to get tenants', details: error.message },
      { status: 500 }
    )
  }
}
