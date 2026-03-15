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

    const { searchParams } = new URL(request.url)
    const requestedUserType = String(searchParams.get('userType') || '').toUpperCase()
    const hintedUserId = String(request.headers.get('x-user-id') || '').trim()
    const hintedUserEmail = String(request.headers.get('x-user-email') || '').trim().toLowerCase()
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
    if (!dbUser && hintedUserId) {
      try {
        dbUser = await db.findUserById(hintedUserId)
      } catch {}
    }
    if (!dbUser && (user.email || hintedUserEmail)) {
      try {
        dbUser = await db.findUserByEmail(user.email || hintedUserEmail)
      } catch {}
    }
    const resolvedUserId = dbUser?.id || hintedUserId || user.id
    const candidateUserIds = Array.from(
      new Set([user.id, resolvedUserId, hintedUserId].filter(Boolean).map((id) => String(id)))
    )
    const resolvedUserType = requestedUserType || dbUser?.userType || user.userType || 'TENANT'
    const normalizedEmail = String(dbUser?.email || user.email || hintedUserEmail || '').toLowerCase()
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

    let payments: any[] = await db.query('payments', {})
    
    console.log('Payments API - Total payments found:', payments.length, 'User ID:', resolvedUserId, 'UserType:', dbUser?.userType)
    
    // 应用过滤
    if (resolvedUserType === 'TENANT') {
      const beforeFilter = payments.length
      payments = payments.filter((p: any) => {
        const pid = String(getField(p, ['userId', 'user_id', 'payerId', 'payer_id', 'tenantId', 'tenant_id']) || '')
        return pid && candidateUserIds.includes(pid)
      })
      console.log('Payments API - After tenant filter:', payments.length, 'from', beforeFilter)
    } else if (resolvedUserType === 'LANDLORD') {
      const landlordIds = new Set(candidateUserIds)
      const propertyIdSet = new Set<string>()
      const leaseIdSet = new Set<string>()
      const tenantIdSet = new Set<string>()
      const properties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
      properties.forEach((p: any) => {
        const ownerId = String(
          getField(p, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']) || ''
        )
        if (ownerId && landlordIds.has(ownerId)) {
          const pid = String(getField(p, ['id', '_id']) || '')
          if (pid) propertyIdSet.add(pid)
          return
        }
        if (!normalizedEmail) return
        const ownerEmail = String(
          getField(p, ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']) || ''
        ).toLowerCase()
        if (ownerEmail && ownerEmail === normalizedEmail) {
          const pid = String(getField(p, ['id', '_id']) || '')
          if (pid) propertyIdSet.add(pid)
        }
      })
      const leases = await db.query('leases', {}, { orderBy: { createdAt: 'desc' } })
      leases.forEach((lease: any) => {
        const leaseLandlordId = String(
          getField(lease, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']) || ''
        )
        const leasePropertyId = String(getField(lease, ['propertyId', 'property_id']) || '')
        if ((leaseLandlordId && landlordIds.has(leaseLandlordId)) || (leasePropertyId && propertyIdSet.has(leasePropertyId))) {
          const leaseId = String(getField(lease, ['id', '_id']) || '')
          const leaseTenantId = String(getField(lease, ['tenantId', 'tenant_id']) || '')
          if (leaseId) leaseIdSet.add(leaseId)
          if (leaseTenantId) tenantIdSet.add(leaseTenantId)
        }
      })
      const applications = await db.query('applications', {}, { orderBy: { createdAt: 'desc' } })
      applications.forEach((application: any) => {
        const applicationPropertyId = String(getField(application, ['propertyId', 'property_id']) || '')
        const applicationLandlordId = String(
          getField(application, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']) || ''
        )
        if ((applicationPropertyId && propertyIdSet.has(applicationPropertyId)) || (applicationLandlordId && landlordIds.has(applicationLandlordId))) {
          const applicationTenantId = String(getField(application, ['tenantId', 'tenant_id', 'userId', 'user_id']) || '')
          if (applicationTenantId) tenantIdSet.add(applicationTenantId)
        }
      })
      payments = payments.filter((p: any) => {
        const pid = String(getField(p, ['propertyId', 'property_id']) || '')
        if (pid && propertyIdSet.has(pid)) return true
        const leaseId = String(getField(p, ['leaseId', 'lease_id']) || '')
        if (leaseId && leaseIdSet.has(leaseId)) return true
        const payerId = String(getField(p, ['tenantId', 'tenant_id', 'userId', 'user_id', 'payerId', 'payer_id']) || '')
        if (payerId && tenantIdSet.has(payerId)) return true
        const paymentLandlordId = String(
          getField(p, ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'payeeId', 'payee_id']) || ''
        )
        if (paymentLandlordId && landlordIds.has(paymentLandlordId)) return true
        const metadata = parseMetadata(p.metadata)
        const metadataLeaseId = String(metadata?.leaseId || metadata?.lease_id || '')
        const metadataPropertyId = String(metadata?.propertyId || metadata?.property_id || '')
        const metadataLandlordId = String(metadata?.landlordId || metadata?.landlord_id || metadata?.ownerId || metadata?.owner_id || '')
        const metadataTenantId = String(metadata?.tenantId || metadata?.tenant_id || metadata?.userId || metadata?.user_id || '')
        if (metadataLeaseId && leaseIdSet.has(metadataLeaseId)) return true
        if (metadataPropertyId && propertyIdSet.has(metadataPropertyId)) return true
        if (metadataLandlordId && landlordIds.has(metadataLandlordId)) return true
        if (metadataTenantId && tenantIdSet.has(metadataTenantId)) return true
        if (!normalizedEmail) return false
        const paymentLandlordEmail = String(
          getField(p, ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']) || ''
        ).toLowerCase()
        return paymentLandlordEmail && paymentLandlordEmail === normalizedEmail
      })
      if (payments.length === 0 && leaseIdSet.size > 0) {
        const leaseMap = new Map<string, any>()
        leases.forEach((lease: any) => {
          const leaseId = String(getField(lease, ['id', '_id']) || '')
          if (!leaseId || !leaseIdSet.has(leaseId)) return
          leaseMap.set(leaseId, lease)
        })
        payments = Array.from(leaseMap.values())
          .map((lease: any) => {
            const leaseId = String(getField(lease, ['id', '_id']) || '')
            const leasePropertyId = String(getField(lease, ['propertyId', 'property_id']) || '')
            const leaseTenantId = String(getField(lease, ['tenantId', 'tenant_id']) || '')
            const createdAt = getField(lease, ['updatedAt', 'updated_at', 'createdAt', 'created_at']) || new Date().toISOString()
            return {
              id: `lease-${leaseId}`,
              leaseId: leaseId || undefined,
              propertyId: leasePropertyId || undefined,
              userId: leaseTenantId || undefined,
              amount: Number(getField(lease, ['rentAmount', 'rent_amount', 'monthlyRent', 'monthly_rent']) || 0),
              status: 'PENDING',
              type: 'RENT',
              description: 'Rent payment',
              createdAt,
              updatedAt: createdAt,
              metadata: { derivedFrom: 'lease' },
            }
          })
          .filter((item: any) => Number(item.amount) > 0)
      }
    } else if (resolvedUserType === 'AGENT') {
      const properties = await db.query('properties', {}, { orderBy: { createdAt: 'desc' } })
      const agentIds = new Set(candidateUserIds)
      const managedProperties = properties.filter((p: any) => {
        const agentId = String(getField(p, ['agentId', 'agent_id']) || '')
        return agentId && agentIds.has(agentId)
      })
      const propertyIds = new Set(
        managedProperties.map((p: any) => String(getField(p, ['id', '_id']) || '')).filter(Boolean)
      )
      payments = payments.filter((p: any) => {
        const pid = String(getField(p, ['propertyId', 'property_id']) || '')
        return pid && propertyIds.has(pid)
      })
    }

    // 排序
    payments.sort((a: any, b: any) => {
      const dateA = new Date(getField(a, ['createdAt', 'created_at', 'updatedAt', 'updated_at']) || 0).getTime()
      const dateB = new Date(getField(b, ['createdAt', 'created_at', 'updatedAt', 'updated_at']) || 0).getTime()
      return dateB - dateA
    })

    // 加载关联数据
    const paymentsWithRelations = await Promise.all(
      payments.map(async (payment: any) => {
        let property = null
        let paymentUser = null
        const paymentPropertyId = String(getField(payment, ['propertyId', 'property_id']) || '')
        const paymentUserId = String(
          getField(payment, ['userId', 'user_id', 'payerId', 'payer_id', 'tenantId', 'tenant_id']) || ''
        )
        
        try {
          if (paymentPropertyId) {
            property = await db.findById('properties', paymentPropertyId)
          }
        } catch (err) {
          console.warn('Failed to load property for payment:', getField(payment, ['id', '_id']), err)
        }
        
        try {
          if (paymentUserId) {
            paymentUser = await db.findUserById(paymentUserId)
          }
        } catch (err) {
          console.warn('Failed to load user for payment:', getField(payment, ['id', '_id']), err)
        }
        
        const metadata = parseMetadata(payment.metadata)
        
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
