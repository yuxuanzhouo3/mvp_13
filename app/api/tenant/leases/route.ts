import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = getAppRegion()
    let leases = []

    if (region === 'global') {
      leases = await prisma.lease.findMany({
        where: { tenantId: user.userId },
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
          },
          listingAgent: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    } else {
      const db = getDatabaseAdapter()
      leases = await db.query('leases', { tenantId: user.userId })
      
      // Enrich with property data
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
    }

    return NextResponse.json({ leases })
  } catch (error: any) {
    console.error('Get leases error:', error)
    return NextResponse.json({ error: 'Failed to get leases', details: error.message }, { status: 500 })
  }
}
