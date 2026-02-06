import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get all tenants (for agents to help find homes)
 * 使用数据库适配器，自动根据环境变量选择数据源
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

    const db = getDatabaseAdapter()

    // Get all tenants - 使用 query 方法查询所有用户，然后过滤
    const allUsers = await db.query('users', {}, {
      orderBy: { createdAt: 'desc' }
    })
    
    // 过滤出租客
    const tenants = allUsers.filter((user: any) => user.userType === 'TENANT')

    console.log(`Found ${tenants.length} tenants in database`)

    // 格式化响应（CloudBase 可能没有 tenantProfile，需要单独处理）
    const formattedTenants = tenants.map((tenant: any) => ({
      id: tenant.id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      createdAt: tenant.createdAt,
      tenantProfile: {
        monthlyIncome: null,
        creditScore: null,
        employmentStatus: null
      }
    }))

    return NextResponse.json({ tenants: formattedTenants })
  } catch (error: any) {
    console.error('Get tenants error:', error)
    return NextResponse.json(
      { error: 'Failed to get tenants', details: error.message },
      { status: 500 }
    )
  }
}
