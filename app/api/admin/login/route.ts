import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

// 管理员账号配置（硬编码，用于快速访问）
const ADMIN_USERNAME = 'morngpt'
const ADMIN_PASSWORD = 'Zyx!213416'

/**
 * 管理员登录（独立于普通用户认证）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      )
    }

    // 仅允许固定管理员账号
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      )
    }

    // 生成管理员专用 JWT token（不写入用户数据库，避免污染真实用户数据）
    const token = jwt.sign(
      { 
        role: 'admin',
        username: ADMIN_USERNAME,
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    )

    return NextResponse.json({
      user: {
        username: ADMIN_USERNAME,
        role: 'admin',
      },
      token,
    })
  } catch (error: any) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: '登录失败', details: error.message },
      { status: 500 }
    )
  }
}
