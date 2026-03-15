import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth-adapter'
import { prisma } from '@/lib/db'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Get current user profile
 */
export async function GET(request: NextRequest) {
  try {
    const timeoutMarker = Symbol('profile-timeout')
    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | typeof timeoutMarker> => {
      return await Promise.race([
        promise,
        new Promise<typeof timeoutMarker>((resolve) => setTimeout(() => resolve(timeoutMarker), timeoutMs))
      ])
    }
    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }
    const decodeTokenHints = (token: string) => {
      try {
        const payloadBase64 = token.split('.')[1]
        if (!payloadBase64) return { userId: '', email: '', userType: '' }
        const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
        const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
        const hintedType = getField(payload, ['userType', 'role']) || getField(payload?.user_metadata, ['userType', 'role']) || getField(payload?.app_metadata, ['userType', 'role'])
        return {
          userId: String(payload?.userId || payload?.sub || payload?.id || ''),
          email: String(payload?.email || payload?.userEmail || ''),
          userType: hintedType ? String(hintedType) : ''
        }
      } catch {
        return { userId: '', email: '', userType: '' }
      }
    }

    const authHeader = request.headers.get('authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : ''
    const headerUserId = String(request.headers.get('x-user-id') || '').trim()
    const headerUserEmail = String(request.headers.get('x-user-email') || '').trim()
    const tokenHints = accessToken ? decodeTokenHints(accessToken) : { userId: '', email: '', userType: '' }

    const unified = await getCurrentUser(request)
    let user: { userId: string; id: string; email: string; userType?: string } | null = unified
      ? {
          userId: unified.id,
          id: unified.id,
          email: unified.email,
          userType: unified.userType
        }
      : null
    if (!user) {
      user = await getAuthUser(request)
    }
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    user = {
      ...user,
      userId: String(user.userId || user.id || headerUserId || tokenHints.userId || ''),
      id: String(user.id || user.userId || headerUserId || tokenHints.userId || ''),
      email: String(user.email || headerUserEmail || tokenHints.email || ''),
      userType: user.userType || tokenHints.userType || undefined,
    }

    const region = getAppRegion()
    const profileSelect = {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      userType: true,
      isPremium: true,
      createdAt: true,
      tenantProfile: true,
      landlordProfile: true,
    }

    if (region === 'china') {
      const db = getDatabaseAdapter()
      let profile: any = null
      if (user.userId) {
        const byIdResult = await withTimeout(db.findUserById(user.userId), 5000)
        profile = byIdResult === timeoutMarker ? null : byIdResult
      }
      if (!profile && user.email) {
        const byEmailResult = await withTimeout(db.findUserByEmail(user.email), 5000)
        profile = byEmailResult === timeoutMarker ? null : byEmailResult
      }
      if (!profile) {
        return NextResponse.json({
          user: {
            id: user.userId,
            name: user.email ? user.email.split('@')[0] : '',
            email: user.email,
            userType: user.userType || 'TENANT',
            isPremium: false
          }
        })
      }
      return NextResponse.json({ user: profile })
    }

    let profileResult: any = null
    try {
      profileResult = await withTimeout(
        prisma.user.findUnique({
          where: { id: user.userId },
          select: profileSelect
        }),
        5000
      )
    } catch (error: any) {
      profileResult = null
    }

    if (profileResult === timeoutMarker) {
      profileResult = null
    }

    if (!profileResult && user.email) {
      try {
        const byEmailResult = await withTimeout(
          prisma.user.findUnique({
            where: { email: user.email },
            select: profileSelect
          }),
          5000
        )
        profileResult = byEmailResult === timeoutMarker ? null : byEmailResult
      } catch {
        profileResult = null
      }
    }

    let profile = profileResult as any
    if (!profile) {
      const db = getDatabaseAdapter()
      const byIdResult = await withTimeout(db.findUserById(user.userId), 5000)
      profile = byIdResult === timeoutMarker ? null : byIdResult
      if (!profile && user.email) {
        const byEmailResult = await withTimeout(db.findUserByEmail(user.email), 5000)
        profile = byEmailResult === timeoutMarker ? null : byEmailResult
      }
    }

    if (!profile && supabaseAdmin) {
      const adminClient: any = supabaseAdmin
      const userTables = ['User', 'users', 'user']
      for (const tableName of userTables) {
        if (user.userId) {
          const byIdResult = await withTimeout(
            adminClient
              .from(tableName)
              .select('id,name,email,phone,avatar,userType,user_type,type,role,isPremium,is_premium,createdAt,tenantProfile,landlordProfile')
              .eq('id', user.userId)
              .limit(1),
            3000
          )
          if (byIdResult !== timeoutMarker && !(byIdResult as any)?.error && (byIdResult as any)?.data?.length > 0) {
            const row = (byIdResult as any).data[0]
            profile = {
              ...row,
              userType: String(getField(row, ['userType', 'user_type', 'type', 'role']) || 'TENANT'),
              isPremium: Boolean(getField(row, ['isPremium', 'is_premium']))
            }
            break
          }
        }
        if (user.email) {
          const byEmailResult = await withTimeout(
            adminClient
              .from(tableName)
              .select('id,name,email,phone,avatar,userType,user_type,type,role,isPremium,is_premium,createdAt,tenantProfile,landlordProfile')
              .ilike('email', user.email)
              .limit(1),
            3000
          )
          if (byEmailResult !== timeoutMarker && !(byEmailResult as any)?.error && (byEmailResult as any)?.data?.length > 0) {
            const row = (byEmailResult as any).data[0]
            profile = {
              ...row,
              userType: String(getField(row, ['userType', 'user_type', 'type', 'role']) || 'TENANT'),
              isPremium: Boolean(getField(row, ['isPremium', 'is_premium']))
            }
            break
          }
        }
      }
    }

    if (!profile) {
      return NextResponse.json({
        user: {
          id: user.userId,
          name: user.email ? user.email.split('@')[0] : '',
          email: user.email,
          userType: user.userType || 'TENANT',
          isPremium: false
        }
      })
    }

    const normalizeType = (value: any) => String(value || '').toUpperCase()
    const finalUserType = normalizeType(profile?.userType || user.userType || 'TENANT')

    return NextResponse.json({
      user: {
        ...profile,
        userType: finalUserType,
        // representedById: profile.tenantProfile?.representedById || null
      }
    })
  } catch (error: any) {
    console.error('Get profile error:', error)
    return NextResponse.json(
      { error: 'Failed to get profile', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Update current user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone, avatar } = body

    const db = getDatabaseAdapter()
    const updatedUser = await db.updateUser(user.userId, {
      ...(name && { name }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(avatar !== undefined && { avatar: avatar || null }),
    })

    return NextResponse.json({
      user: {
        ...updatedUser,
        // representedById: updatedUser.tenantProfile?.representedById || null
      }
    })
  } catch (error: any) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: 'Failed to update profile', details: error.message },
      { status: 500 }
    )
  }
}
