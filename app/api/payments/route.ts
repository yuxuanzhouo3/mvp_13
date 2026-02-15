import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase'

/**
 * Get payments for current user
 */
export async function GET(request: NextRequest) {
  try {
    let user = await getCurrentUser(request)
    if (!user) {
      const legacy = await getAuthUser(request)
      if (legacy) {
        user = {
          id: legacy.userId || legacy.id,
          email: legacy.email || '',
          userType: legacy.userType
        }
      }
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const db = getDatabaseAdapter()
    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined
    const supabaseClient = createSupabaseServerClient(accessToken)
    const supabaseReaders = [supabaseClient, supabaseAdmin].filter(Boolean) as any[]
    const isConnectionError = (error: any) => {
      const msg = String(error?.message || '').toLowerCase()
      return msg.includes('server has closed the connection') ||
        msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('pool') ||
        msg.includes('maxclients')
    }
    let dbUser: any = null
    try {
      dbUser = await db.findUserById(user.id)
    } catch {}
    if (!dbUser && user.email) {
      try {
        dbUser = await db.findUserByEmail(user.email)
      } catch {}
    }
    if (!dbUser && supabaseReaders.length > 0) {
      const userTables = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
      for (const client of supabaseReaders) {
        for (const tableName of userTables) {
          if (user.id) {
            const { data, error } = await client
              .from(tableName)
              .select('id,email,userType,name')
              .eq('id', user.id)
              .limit(1)
            if (!error && data && data.length > 0) {
              dbUser = data[0]
              break
            }
          }
          if (user.email) {
            const { data, error } = await client
              .from(tableName)
              .select('id,email,userType,name')
              .ilike('email', user.email)
              .limit(1)
            if (!error && data && data.length > 0) {
              dbUser = data[0]
              break
            }
          }
        }
        if (dbUser) break
      }
    }
    const resolvedUserId = dbUser?.id || user.id
    const resolvedUserType = String(dbUser?.userType || user.userType || '').toUpperCase()
    let tokenUserId: string | null = null
    if (accessToken && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.getUser(accessToken)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }
    if (!tokenUserId && accessToken && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.auth.getUser(accessToken)
        if (data?.user?.id) {
          tokenUserId = String(data.user.id)
        }
      } catch {}
    }

    const where: any = {}
    
    if (resolvedUserType === 'TENANT') {
      // Tenants see their own payments
      where.userId = resolvedUserId
    } else if (resolvedUserType === 'LANDLORD') {
      const landlordIds = new Set<string>([String(resolvedUserId), String(user.id)])
      if (tokenUserId) landlordIds.add(String(tokenUserId))
      where.property = {
        landlordId: landlordIds.size === 1 ? Array.from(landlordIds)[0] : { in: Array.from(landlordIds) }
      }
    }
    let useSupabaseRest = false
    if (region === 'global') {
      try {
        await prisma.payment.count()
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        useSupabaseRest = true
      }
    }
    const effectiveDb = db
    if (region === 'global' && !useSupabaseRest) {
      const payments = await prisma.payment.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              title: true,
              address: true
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      if (payments.length > 0 || supabaseReaders.length === 0) {
        return NextResponse.json({ payments })
      }
    }

    if (region === 'global') {
      if (supabaseReaders.length === 0) {
        return NextResponse.json({ payments: [] })
      }
      const paymentTables = ['Payment', 'payment', 'payments']
      const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
      const userTables = ['User', 'user', 'users', 'Profile', 'profile', 'profiles']
      const paymentUserFields = ['userId', 'user_id']
      const paymentPropertyFields = ['propertyId', 'property_id']
      const landlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
      const emailFields = ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']

      let propertyIds: string[] = []
      if (resolvedUserType === 'LANDLORD') {
        const landlordIds = new Set<string>([String(resolvedUserId), String(user.id)])
        if (tokenUserId) landlordIds.add(String(tokenUserId))
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            for (const landlordField of landlordFields) {
              const { data, error } = await client
                .from(tableName)
                .select('id,landlordId,landlord_id')
                .in(landlordField, Array.from(landlordIds))
              if (!error && data?.length) {
                propertyIds = data.map((row: any) => row.id).filter(Boolean)
                break
              }
            }
            if (propertyIds.length > 0) break
          }
          if (propertyIds.length > 0) break
        }
        if (propertyIds.length === 0 && user.email) {
          for (const client of supabaseReaders) {
            for (const tableName of propertyTables) {
              for (const landlordField of landlordFields) {
                const { data, error } = await client
                  .from(tableName)
                  .select('id,landlordId,landlord_id')
                  .ilike(landlordField, user.email)
                if (!error && data?.length) {
                  propertyIds = data.map((row: any) => row.id).filter(Boolean)
                  break
                }
              }
              if (propertyIds.length > 0) break
            }
            if (propertyIds.length > 0) break
          }
        }
        if (propertyIds.length === 0 && user.email) {
          for (const client of supabaseReaders) {
            for (const tableName of propertyTables) {
              for (const emailField of emailFields) {
                const { data, error } = await client
                  .from(tableName)
                  .select('id,landlordId,landlord_id')
                  .ilike(emailField, user.email)
                if (!error && data?.length) {
                  propertyIds = data.map((row: any) => row.id).filter(Boolean)
                  break
                }
              }
              if (propertyIds.length > 0) break
            }
            if (propertyIds.length > 0) break
          }
        }
      }

      let payments: any[] = []
      for (const client of supabaseReaders) {
        for (const tableName of paymentTables) {
          for (const userField of paymentUserFields) {
            for (const propertyField of paymentPropertyFields) {
              let query = client.from(tableName).select('*')
              if (resolvedUserType === 'TENANT') {
                query = query.eq(userField, resolvedUserId)
              } else if (resolvedUserType === 'LANDLORD') {
                if (propertyIds.length === 0) {
                  return NextResponse.json({ payments: [] })
                }
                query = query.in(propertyField, propertyIds)
              }
              const { data, error } = await query
              if (!error && data?.length) {
                payments = data
                break
              }
            }
            if (payments.length > 0) break
          }
          if (payments.length > 0) break
        }
        if (payments.length > 0) break
      }

      if (payments.length === 0) {
        return NextResponse.json({ payments: [] })
      }

      const normalizedPayments = payments.map((p: any) => ({
        ...p,
        id: p.id ?? p._id,
        userId: p.userId ?? p.user_id,
        propertyId: p.propertyId ?? p.property_id,
        amount: p.amount ?? p.total,
        status: p.status,
        createdAt: p.createdAt ?? p.created_at,
        updatedAt: p.updatedAt ?? p.updated_at,
        paidAt: p.paidAt ?? p.paid_at
      }))

      const propertyIdSet = new Set(normalizedPayments.map((p: any) => String(p.propertyId || '')).filter(Boolean))
      const userIdSet = new Set(normalizedPayments.map((p: any) => String(p.userId || '')).filter(Boolean))
      const propertyMap = new Map<string, any>()
      const userMap = new Map<string, any>()

      if (propertyIdSet.size > 0) {
        for (const client of supabaseReaders) {
          for (const tableName of propertyTables) {
            const { data, error } = await client
              .from(tableName)
              .select('id,title,address')
              .in('id', Array.from(propertyIdSet))
            if (!error && data) {
              data.forEach((row: any) => propertyMap.set(String(row.id), row))
              break
            }
          }
          if (propertyMap.size > 0) break
        }
      }

      if (userIdSet.size > 0) {
        for (const client of supabaseReaders) {
          for (const tableName of userTables) {
            const { data, error } = await client
              .from(tableName)
              .select('id,name,email')
              .in('id', Array.from(userIdSet))
            if (!error && data) {
              data.forEach((row: any) => userMap.set(String(row.id), row))
              break
            }
          }
          if (userMap.size > 0) break
        }
      }

      const paymentsWithRelations = normalizedPayments.map((p: any) => {
        const property = p.propertyId ? propertyMap.get(String(p.propertyId)) : null
        const paymentUser = p.userId ? userMap.get(String(p.userId)) : null
        return {
          ...p,
          property: property ? { id: property.id, title: property.title, address: property.address } : null,
          user: paymentUser ? { id: paymentUser.id, name: paymentUser.name, email: paymentUser.email } : null
        }
      })

      return NextResponse.json({ payments: paymentsWithRelations })
    }

    let payments = await effectiveDb.query('payments', {})
    if (resolvedUserType === 'TENANT') {
      payments = payments.filter((p: any) => String(p.userId || p.user_id || '') === String(resolvedUserId))
    } else if (resolvedUserType === 'LANDLORD') {
      const landlordIds = new Set<string>([String(resolvedUserId), String(user.id)])
      if (tokenUserId) landlordIds.add(String(tokenUserId))
      const properties = await effectiveDb.query('properties', {})
      const propertyIds = new Set(
        properties
          .filter((p: any) => landlordIds.has(String(p.landlordId || p.landlord_id || '')))
          .map((p: any) => p.id || p._id)
          .filter(Boolean)
      )
      payments = payments.filter((p: any) => {
        const pid = String(p.propertyId || p.property_id || '')
        return pid && propertyIds.has(pid)
      })
    }

    const paymentsWithRelations = await Promise.all(
      payments.map(async (p: any) => {
        const [property, paymentUser] = await Promise.all([
          p.propertyId ? effectiveDb.findById('properties', p.propertyId) : null,
          p.userId ? effectiveDb.findUserById(p.userId) : null
        ])
        return {
          ...p,
          property: property ? {
            id: property.id,
            title: property.title,
            address: property.address
          } : null,
          user: paymentUser ? {
            id: paymentUser.id,
            name: paymentUser.name,
            email: paymentUser.email
          } : null
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
