import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get testimonials for the landing page
 */
export async function GET(request: NextRequest) {
  try {
    // 使用数据库适配器，自动根据环境变量选择正确的数据库
    const db = getDatabaseAdapter()
    
    // 查询testimonials（使用数据库适配器，自动处理 Prisma 和 CloudBase 的差异）
    const testimonials = await db.query('testimonials', { isActive: true }, {
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

    // 使用数据库适配器
    const db = getDatabaseAdapter()
    
    const testimonial = await db.create('testimonials', {
      name,
      role,
      content,
      rating: parseInt(rating),
      avatar: avatar || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
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
