import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getAuthUser } from '@/lib/auth'
import { getDatabaseAdapter } from '@/lib/db-adapter'

export async function GET(request: NextRequest) {
  try {
    let user = await getCurrentUser(request)
    if (!user) {
      const legacyAuth = await getAuthUser(request)
      if (legacyAuth) {
        const db = getDatabaseAdapter()
        const dbUser = (await db.findUserById(legacyAuth.userId).catch(() => null)) ||
          (legacyAuth.email ? await db.findUserByEmail(legacyAuth.email).catch(() => null) : null)
        if (dbUser) {
          user = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            userType: dbUser.userType,
            isPremium: dbUser.isPremium ?? false,
            vipLevel: dbUser.vipLevel ?? 'FREE',
          }
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getDatabaseAdapter()
    let resolvedUserId = user.id

    try {
      const userById = await db.findUserById(user.id)
      const userByEmail = !userById && user.email ? await db.findUserByEmail(user.email) : null
      const resolvedUser = userById || userByEmail
      if (resolvedUser?.id) resolvedUserId = resolvedUser.id
    } catch {}

    const landlordIdsForQuery: string[] = [String(resolvedUserId)]
    if (user.id && String(user.id) !== String(resolvedUserId)) landlordIdsForQuery.push(String(user.id))
    const landlordIdSet = new Set(landlordIdsForQuery.map((id) => String(id)))
    const normalizedEmail = String(user.email || '').trim().toLowerCase()

    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }

    const parseMetadata = (value: any) => {
      if (!value) return {}
      if (typeof value === 'object') return value
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          return parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
          return {}
        }
      }
      return {}
    }

    const allProperties = await db.query('properties', {})
    const myProperties = allProperties.filter((p: any) => {
      const ownerId = String(
        getField(p, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']) || ''
      )
      if (ownerId && landlordIdSet.has(ownerId)) return true
      if (!normalizedEmail) return false
      const ownerEmail = String(
        getField(p, ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']) || ''
      ).toLowerCase()
      return ownerEmail && ownerEmail === normalizedEmail
    })
    const propertyMap = new Map(
      myProperties.map((p: any) => [String(getField(p, ['id', '_id'])), p])
    )
    const propertyIdSet = new Set(Array.from(propertyMap.keys()))

    const allLeases = await db.query('leases', {})
    const myLeases = allLeases.filter((lease: any) => {
      const leasePropertyId = String(getField(lease, ['propertyId', 'property_id']) || '')
      if (leasePropertyId && propertyIdSet.has(leasePropertyId)) return true
      const leaseLandlordId = String(
        getField(lease, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']) || ''
      )
      return leaseLandlordId && landlordIdSet.has(leaseLandlordId)
    })
    const allApplications = await db.query('applications', {})
    const myApplications = allApplications.filter((application: any) => {
      const applicationPropertyId = String(getField(application, ['propertyId', 'property_id']) || '')
      if (applicationPropertyId && propertyIdSet.has(applicationPropertyId)) return true
      const applicationLandlordId = String(
        getField(application, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']) || ''
      )
      return applicationLandlordId && landlordIdSet.has(applicationLandlordId)
    })
    const leaseMap = new Map(
      myLeases.map((l: any) => [String(getField(l, ['id', '_id'])), l])
    )
    const leaseIdSet = new Set(Array.from(leaseMap.keys()))
    const tenantIdFromLeaseSet = new Set(
      myLeases
        .map((lease: any) => String(getField(lease, ['tenantId', 'tenant_id']) || ''))
        .filter(Boolean)
    )
    const tenantIdFromApplicationSet = new Set(
      myApplications
        .map((application: any) => String(getField(application, ['tenantId', 'tenant_id', 'userId', 'user_id']) || ''))
        .filter(Boolean)
    )

    const allPayments = await db.query('payments', {})
    const filteredPayments = allPayments.filter((payment: any) => {
      const paymentPropertyId = String(getField(payment, ['propertyId', 'property_id']) || '')
      const paymentLeaseId = String(getField(payment, ['leaseId', 'lease_id']) || '')
      const paymentTenantId = String(
        getField(payment, ['tenantId', 'tenant_id', 'userId', 'user_id', 'payerId', 'payer_id']) || ''
      )
      const paymentLandlordId = String(
        getField(payment, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'payeeId', 'payee_id']) || ''
      )
      if (paymentPropertyId && propertyIdSet.has(paymentPropertyId)) return true
      if (paymentLeaseId && leaseIdSet.has(paymentLeaseId)) return true
      if (paymentTenantId && (tenantIdFromLeaseSet.has(paymentTenantId) || tenantIdFromApplicationSet.has(paymentTenantId))) return true
      if (paymentLandlordId && landlordIdSet.has(paymentLandlordId)) return true
      const metadata = parseMetadata(payment.metadata)
      const metadataLeaseId = String(metadata?.leaseId || metadata?.lease_id || '')
      const metadataPropertyId = String(metadata?.propertyId || metadata?.property_id || '')
      if (metadataLeaseId && leaseIdSet.has(metadataLeaseId)) return true
      if (metadataPropertyId && propertyIdSet.has(metadataPropertyId)) return true
      return false
    })

    const tenantIdSet = new Set<string>([...Array.from(tenantIdFromLeaseSet), ...Array.from(tenantIdFromApplicationSet)])
    filteredPayments.forEach((payment: any) => {
      const tenantId = String(
        getField(payment, ['tenantId', 'tenant_id', 'userId', 'user_id', 'payerId', 'payer_id']) || ''
      )
      if (tenantId) tenantIdSet.add(tenantId)
    })
    const tenantMap = new Map<string, any>()
    for (const tenantId of tenantIdSet) {
      const tenant = await db.findUserById(tenantId).catch(() => null)
      if (tenant) tenantMap.set(String(tenant.id), tenant)
    }

    const sourcePayments = filteredPayments.length > 0
      ? filteredPayments
      : myLeases.map((lease: any) => {
          const leaseId = String(getField(lease, ['id', '_id']) || '')
          const leaseTenantId = String(getField(lease, ['tenantId', 'tenant_id']) || '')
          const leasePropertyId = String(getField(lease, ['propertyId', 'property_id']) || '')
          return {
            id: `lease-${leaseId}`,
            amount: Number(getField(lease, ['rentAmount', 'rent_amount', 'monthlyRent', 'monthly_rent']) || 0),
            status: 'PENDING',
            type: 'RENT',
            description: 'Rent payment',
            leaseId: leaseId || undefined,
            propertyId: leasePropertyId || undefined,
            tenantId: leaseTenantId || undefined,
            createdAt: getField(lease, ['updatedAt', 'updated_at', 'createdAt', 'created_at']) || new Date().toISOString(),
            updatedAt: getField(lease, ['updatedAt', 'updated_at', 'createdAt', 'created_at']) || new Date().toISOString(),
          }
        }).filter((payment: any) => Number(payment.amount) > 0)

    const payments = sourcePayments
      .map((payment: any) => {
        const paymentLeaseId = String(getField(payment, ['leaseId', 'lease_id']) || '')
        const paymentPropertyId = String(getField(payment, ['propertyId', 'property_id']) || '')
        const paymentTenantId = String(
          getField(payment, ['tenantId', 'tenant_id', 'userId', 'user_id', 'payerId', 'payer_id']) || ''
        )
        const lease = paymentLeaseId ? leaseMap.get(paymentLeaseId) : null
        const resolvedPropertyId = paymentPropertyId || String(getField(lease, ['propertyId', 'property_id']) || '')
        const property = resolvedPropertyId ? propertyMap.get(resolvedPropertyId) : null
        const tenant = paymentTenantId ? tenantMap.get(paymentTenantId) : null
        return {
          id: getField(payment, ['id', '_id']),
          amount: payment.amount,
          status: payment.status,
          date: getField(payment, ['createdAt', 'created_at', 'updatedAt', 'updated_at']),
          type: payment.type,
          propertyTitle: property?.title || 'Unknown Property',
          tenantName: tenant?.name || getField(lease, ['tenantName', 'tenant_name']) || 'Unknown Tenant',
          description: payment.description,
        }
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date || 0).getTime()
        const dateB = new Date(b.date || 0).getTime()
        return dateB - dateA
      })

    return NextResponse.json({ payments })

  } catch (error: any) {
    console.error('Error fetching landlord payments:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
