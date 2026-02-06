import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getAppRegion, getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get current user profile
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

    const profile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
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
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        ...profile,
        representedById: profile.tenantProfile?.representedById || null
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
    const user = getAuthUser(request)
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
        representedById: updatedUser.tenantProfile?.representedById || null
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
