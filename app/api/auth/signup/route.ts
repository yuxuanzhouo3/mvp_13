import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, name, phone, userType } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      )
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 400 }
      )
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        userType: userType || 'TENANT',
        ...(userType === 'TENANT' && {
          tenantProfile: {
            create: {}
          }
        }),
        ...(userType === 'LANDLORD' && {
          landlordProfile: {
            create: {}
          }
        })
      },
      select: {
        id: true,
        email: true,
        name: true,
        userType: true,
        isPremium: true
      }
    })

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    return NextResponse.json({
      user,
      token
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: '注册失败', details: error.message },
      { status: 500 }
    )
  }
}
