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
    let user = await getAuthUser(request)
    if (!user) {
      const unified = await getCurrentUser(request)
      if (unified) {
        user = {
          userId: unified.id,
          id: unified.id,
          email: unified.email,
          userType: unified.userType
        }
      }
    }
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const region = getAppRegion()
    if (region === 'china') {
      const db = getDatabaseAdapter()
      const profile = await db.findUserById(user.userId)
      if (!profile) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ user: profile })
    }

    const timeoutPromise = new Promise<{ __timeout: true }>((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), 3000)
    )
    const getField = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }
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
    let profileResult: any = null
    try {
      profileResult = await Promise.race([
        prisma.user.findUnique({
          where: { id: user.userId },
          select: profileSelect
        }),
        timeoutPromise
      ])
    } catch (error: any) {
      profileResult = null
    }

    if ((profileResult as any)?.__timeout) {
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

    let profile = profileResult as any
    if (!profile && user.email) {
      try {
        profile = await prisma.user.findUnique({
          where: { email: user.email },
          select: profileSelect
        })
      } catch (error: any) {
        profile = null
      }
    }
    if (!profile && supabaseAdmin) {
      const userTables = ['User', 'user', 'users', 'profiles', 'profile', 'user_profiles', 'userProfiles']
      for (const tableName of userTables) {
        if (user.userId) {
          const { data, error } = await supabaseAdmin
            .from(tableName)
            .select('id,name,email,phone,avatar,userType,user_type,type,role,isPremium,is_premium,createdAt,tenantProfile,landlordProfile')
            .eq('id', user.userId)
            .limit(1)
          if (!error && data && data.length > 0) {
            const row = data[0]
            profile = {
              ...row,
              userType: String(getField(row, ['userType', 'user_type', 'type', 'role']) || row.userType || 'TENANT'),
              isPremium: Boolean(getField(row, ['isPremium', 'is_premium']))
            }
            break
          }
        }
        if (user.email) {
          const { data, error } = await supabaseAdmin
            .from(tableName)
            .select('id,name,email,phone,avatar,userType,user_type,type,role,isPremium,is_premium,createdAt,tenantProfile,landlordProfile')
            .ilike('email', user.email)
            .limit(1)
          if (!error && data && data.length > 0) {
            const row = data[0]
            profile = {
              ...row,
              userType: String(getField(row, ['userType', 'user_type', 'type', 'role']) || row.userType || 'TENANT'),
              isPremium: Boolean(getField(row, ['isPremium', 'is_premium']))
            }
            break
          }
        }
      }
    }
    if (!profile) {
      const fallbackUserType = (user.userType || 'TENANT').toUpperCase()
      try {
        const created = await prisma.user.create({
          data: {
            id: user.userId,
            email: user.email,
            password: `supabase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: user.email ? user.email.split('@')[0] : 'user',
            userType: fallbackUserType,
            isPremium: false,
            vipLevel: 'FREE',
            dailyQuota: 10,
            monthlyQuota: 100,
            ...(fallbackUserType === 'TENANT' && {
              tenantProfile: { create: {} }
            }),
            ...(fallbackUserType === 'LANDLORD' && {
              landlordProfile: { create: {} }
            })
          },
          select: profileSelect
        })
        profile = created
      } catch (error: any) {
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
    }

    const normalizeType = (value: any) => String(value || '').toUpperCase()
    let finalUserType = normalizeType(profile?.userType || user.userType || 'TENANT')
    const detectLandlord = async () => {
      if (finalUserType === 'LANDLORD') return
      if (profile?.landlordProfile) {
        finalUserType = 'LANDLORD'
        return
      }
      const candidateIds = Array.from(new Set([profile?.id, user.userId, user.id].filter(Boolean).map((id) => String(id))))
      try {
        if (candidateIds.length > 0) {
          const propertyCount = await prisma.property.count({
            where: { landlordId: { in: candidateIds } }
          })
          if (propertyCount > 0) {
            finalUserType = 'LANDLORD'
            return
          }
        }
      } catch {}
      if (supabaseAdmin) {
        const propertyTables = ['Property', 'property', 'properties', 'Listing', 'listing', 'listings']
        const landlordFields = ['landlordId', 'landlord_id', 'ownerId', 'owner_id', 'userId', 'user_id']
        for (const tableName of propertyTables) {
          if (candidateIds.length > 0) {
            for (const landlordField of landlordFields) {
              const { data, error } = await supabaseAdmin
                .from(tableName)
                .select('id')
                .in(landlordField, candidateIds)
                .limit(1)
              if (!error && data && data.length > 0) {
                finalUserType = 'LANDLORD'
                return
              }
            }
          }
          if (user.email) {
            for (const emailField of ['landlordEmail', 'landlord_email', 'ownerEmail', 'owner_email', 'userEmail', 'user_email']) {
              const { data, error } = await supabaseAdmin
                .from(tableName)
                .select('id')
                .ilike(emailField, user.email)
                .limit(1)
              if (!error && data && data.length > 0) {
                finalUserType = 'LANDLORD'
                return
              }
            }
          }
        }
      }
    }
    await detectLandlord()
    if (finalUserType && normalizeType(profile.userType) !== finalUserType) {
      try {
        await prisma.user.update({
          where: { id: profile.id },
          data: { userType: finalUserType }
        })
      } catch {}
    }

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

    const region = getAppRegion()
    if (region === 'china') {
      const db = getDatabaseAdapter()
      const updatedUser = await db.updateUser(user.userId, {
        ...(name && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(avatar !== undefined && { avatar: avatar || null }),
      })
      return NextResponse.json({ user: updatedUser })
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(avatar !== undefined && { avatar: avatar || null }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        userType: true,
        isPremium: true,
        tenantProfile: true,
        landlordProfile: true,
      }
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
