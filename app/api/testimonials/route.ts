import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { getCurrentUser } from '@/lib/auth-adapter'

/**
 * Get testimonials for the landing page
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedUserType = String(searchParams.get('userType') || '').trim().toUpperCase()
    const scope = String(searchParams.get('scope') || '').trim().toLowerCase()
    const roleMap: Record<string, string[]> = {
      LANDLORD: ['LANDLORD', '房东'],
      TENANT: ['TENANT', '租客'],
      AGENT: ['AGENT', '中介'],
    }
    const requestedRoles = roleMap[requestedUserType] || []
    const shouldRoleFilter = requestedRoles.length > 0 || scope === 'dashboard'
    const db = getDatabaseAdapter()
    let testimonials = await db.query('testimonials', { isActive: true }, {
      orderBy: { createdAt: 'desc' },
      take: shouldRoleFilter ? 100 : 6
    })
    if (testimonials.length === 0) {
      testimonials = await db.query('testimonials', {}, {
        orderBy: { createdAt: 'desc' },
        take: shouldRoleFilter ? 100 : 6
      })
    }
    if (shouldRoleFilter) {
      const targetRoleTokens = requestedRoles.length > 0 ? requestedRoles : ['LANDLORD', '房东']
      const normalizedTargetRoleTokens = targetRoleTokens.map((role) => role.toUpperCase())
      testimonials = testimonials.filter((item: any) => {
        const role = String(item?.role || '').trim().toUpperCase()
        return normalizedTargetRoleTokens.some((token) => role.includes(token))
      })
    }

    return NextResponse.json({ testimonials })
  } catch (error: any) {
    console.error('Get testimonials error:', error)
    return NextResponse.json({ testimonials: [] })
  }
}

/**
 * Create a new testimonial (any authenticated user can create)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, role, content, rating, avatar } = body

    if (!name || !role || !content || !rating) {
      return NextResponse.json(
        { error: 'Name, role, content and rating are required' },
        { status: 400 }
      )
    }

    const db = getDatabaseAdapter()
    
    const testimonial = await db.create('testimonials', {
      name,
      role,
      content,
      rating: parseInt(String(rating)),
      avatar: avatar || null,
      isActive: true,
      createdAt: new Date(),
    })

    return NextResponse.json({ testimonial })
  } catch (error: any) {
    console.error('Create testimonial error:', error)
    return NextResponse.json(
      { error: 'Failed to create testimonial', details: error.message },
      { status: 500 }
    )
  }
}
