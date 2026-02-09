import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'

/**
 * Get tenants for landlord (approved applications and active leases)
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

    const region = getAppRegion()
    const db = getDatabaseAdapter()
    let resolvedUserId = user.id
    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) {
        resolvedUserId = resolvedUser.id
      }
    } catch {}

    const isConnectionError = (error: any) => {
      const msg = String(error?.message || '').toLowerCase()
      return msg.includes('server has closed the connection') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('pool') ||
        msg.includes('maxclients')
    }

    const runWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn()
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        try {
          await prisma.$disconnect()
        } catch {}
        try {
          await prisma.$connect()
        } catch {}
        return await fn()
      }
    }

    let properties: any[] = []
    if (region === 'global') {
      properties = await runWithRetry(() => prisma.property.findMany({
        where: { landlordId: resolvedUserId },
        select: { id: true, title: true }
      }))
    } else {
      properties = await db.query('properties', { landlordId: resolvedUserId })
    }

    const propertyIds = properties.map(p => p.id)
    if (propertyIds.length === 0) {
      return NextResponse.json({ tenants: [] })
    }

    let approvedApplications: any[] = []
    if (region === 'global') {
      approvedApplications = await runWithRetry(() => prisma.application.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: 'APPROVED'
        },
        select: {
          id: true,
          tenantId: true,
          propertyId: true,
          appliedDate: true,
          monthlyIncome: true,
          creditScore: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' }
      }))
    } else {
      const rawApps = await db.query('applications', { status: 'APPROVED' })
      approvedApplications = rawApps.filter((app: any) => propertyIds.includes(app.propertyId))
    }

    let activeLeases: any[] = []
    if (region === 'global') {
      activeLeases = await runWithRetry(() => prisma.lease.findMany({
        where: {
          landlordId: resolvedUserId,
          status: 'ACTIVE'
        },
        select: {
          id: true,
          tenantId: true,
          propertyId: true,
          startDate: true,
          endDate: true,
          monthlyRent: true,
          status: true
        }
      }))
    } else {
      const rawLeases = await db.query('leases', { landlordId: resolvedUserId })
      activeLeases = rawLeases.filter((lease: any) => lease.status === 'ACTIVE')
    }

    // Fetch tenant info for leases
    const tenantsFromLeases = await Promise.all(
      activeLeases.map(async (lease) => {
        let tenant = null
        let property = null
        if (region === 'global') {
          tenant = await runWithRetry(() => prisma.user.findUnique({
            where: { id: lease.tenantId },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }))
          if (lease.propertyId) {
            property = await runWithRetry(() => prisma.property.findUnique({
              where: { id: lease.propertyId },
              select: { id: true, title: true, address: true }
            }))
          }
        } else {
          tenant = await db.findUserById(lease.tenantId)
          if (lease.propertyId) {
            property = await db.findById('properties', lease.propertyId)
          }
        }
        if (!tenant) return null
        return {
          id: tenant?.id || lease.tenantId,
          name: tenant?.name,
          email: tenant?.email,
          phone: tenant?.phone,
          propertyId: property?.id,
          propertyName: property?.title,
          propertyAddress: property?.address,
          leaseStart: lease.startDate,
          leaseEnd: lease.endDate,
          monthlyRent: lease.monthlyRent,
          source: 'lease'
        }
      })
    )

    // Combine and deduplicate tenants
    let tenantsFromApplications: any[] = []
    if (region === 'global') {
      tenantsFromApplications = (await Promise.all(
        approvedApplications.map(async (app) => {
          const tenant = await runWithRetry(() => prisma.user.findUnique({
            where: { id: app.tenantId },
            select: { id: true, name: true, email: true, phone: true }
          }))
          const property = app.propertyId ? await runWithRetry(() => prisma.property.findUnique({
            where: { id: app.propertyId },
            select: { id: true, title: true, address: true }
          })) : null
          if (!tenant) return null
          return {
            id: tenant?.id || app.tenantId,
            name: tenant?.name,
            email: tenant?.email,
            phone: tenant?.phone,
            propertyId: property?.id || app.propertyId,
            propertyName: property?.title,
            propertyAddress: property?.address,
            applicationDate: app.appliedDate,
            source: 'application'
          }
        })
      )).filter(Boolean)
    } else {
      tenantsFromApplications = (await Promise.all(
        approvedApplications.map(async (app: any) => {
          const tenant = await db.findUserById(app.tenantId)
          const property = app.propertyId ? await db.findById('properties', app.propertyId) : null
          if (!tenant) return null
          return {
            id: tenant?.id || app.tenantId,
            name: tenant?.name,
            email: tenant?.email,
            phone: tenant?.phone,
            propertyId: property?.id || app.propertyId,
            propertyName: property?.title,
            propertyAddress: property?.address,
            applicationDate: app.appliedDate,
            source: 'application'
          }
        })
      )).filter(Boolean)
    }

    // Deduplicate by tenant ID
    const tenantMap = new Map<string, any>()
    tenantsFromLeases.filter(Boolean).forEach(t => {
      const tenantId = t?.id ? String(t.id) : ''
      if (tenantId) tenantMap.set(tenantId, t)
    })
    tenantsFromApplications.filter(Boolean).forEach(t => {
      const tenantId = t?.id ? String(t.id) : ''
      if (tenantId && !tenantMap.has(tenantId)) {
        tenantMap.set(tenantId, t)
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
