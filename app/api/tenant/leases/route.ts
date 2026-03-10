import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { prisma } from '@/lib/db'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = getAppRegion()
    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
    let resolvedUserType = user.userType
    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) {
        resolvedUserId = resolvedUser.id
      }
      if (resolvedUser?.userType) {
        resolvedUserType = resolvedUser.userType
      }
    } catch {}

    let leases = []
    if (region === 'global') {
      let prismaLeases: any[] = []
      try {
        prismaLeases = await prisma.lease.findMany({
          where: { tenantId: resolvedUserId },
          include: {
            property: {
              select: {
                id: true,
                title: true,
                address: true,
                city: true,
                state: true,
                images: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      } catch {
        prismaLeases = []
      }

      if (prismaLeases.length > 0) {
        leases = prismaLeases
      } else {
        const allLeases = await db.query('leases', {}, { orderBy: { createdAt: 'desc' } })
        leases = allLeases.filter((l: any) => {
          if ((resolvedUserType || '').toUpperCase() === 'LANDLORD') {
            return l.landlordId === resolvedUserId
          }
          return l.tenantId === resolvedUserId || l.tenantId === user.id
        })
      }
    } else {
      let allLeases = await db.query('leases', {})
      leases = allLeases.filter((l: any) => l.tenantId === resolvedUserId || l.tenantId === user.id)
    }

    leases = await Promise.all(leases.map(async (lease: any) => {
      const property = await db.findById('properties', lease.propertyId)
      let listingAgent = null
      if (lease.listingAgentId) {
        listingAgent = await db.findUserById(lease.listingAgentId)
      }
      return {
        ...lease,
        property: property ? {
          id: property.id,
          title: property.title,
          address: property.address,
          city: property.city,
          state: property.state,
          images: property.images
        } : null,
        listingAgent: listingAgent ? {
          id: listingAgent.id,
          name: listingAgent.name,
          email: listingAgent.email,
          phone: listingAgent.phone
        } : null
      }
    }))

    return NextResponse.json({ leases })
  } catch (error: any) {
    console.error('Get leases error:', error)
    return NextResponse.json({ error: 'Failed to get leases', details: error.message }, { status: 500 })
  }
}
