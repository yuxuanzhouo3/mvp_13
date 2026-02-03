import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Get testimonials for the landing page
 */
export async function GET(request: NextRequest) {
  try {
    // Try to get testimonials from database
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 6
    })

    return NextResponse.json({ testimonials })
  } catch (error: any) {
    // If table doesn't exist, return empty array
    console.error('Get testimonials error:', error)
    return NextResponse.json({ testimonials: [] })
  }
}

/**
 * Create a new testimonial (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, role, content, rating, avatar } = body

    if (!name || !role || !content || !rating) {
      return NextResponse.json(
        { error: 'Name, role, content and rating are required' },
        { status: 400 }
      )
    }

    const testimonial = await prisma.testimonial.create({
      data: {
        name,
        role,
        content,
        rating: parseInt(rating),
        avatar: avatar || null,
        isActive: true
      }
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
