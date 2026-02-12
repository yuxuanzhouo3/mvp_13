import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth-adapter'
import { createDatabaseAdapter, getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'
import { supabaseAdmin } from '@/lib/supabase'

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
    const resolvedUserId = dbUser?.id || user.id
    const resolvedUserType = dbUser?.userType || user.userType
    let tokenUserId: string | null = null
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ') && supabaseAdmin) {
      const token = authHeader.substring(7)
      try {
        const { data } = await supabaseAdmin.auth.getUser(token)
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
    let useFallback = false
    if (region === 'global') {
      try {
        await prisma.payment.count()
      } catch (error: any) {
        if (!isConnectionError(error)) {
          throw error
        }
        useFallback = true
      }
    }
    const effectiveDb = useFallback ? createDatabaseAdapter('china') : db
    if (region === 'global' && !useFallback) {
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

      return NextResponse.json({ payments })
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
