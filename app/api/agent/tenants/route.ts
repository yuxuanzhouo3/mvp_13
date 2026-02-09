import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * Get all tenants (for agents to help find homes)
 * 使用数据库适配器，自动根据环境变量选择数据源
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()

    const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
    const filters: any = {
      userType: 'TENANT'
    }
    if (isChina) {
      filters.representedById = user.id
    }

    // Get tenants
    const allUsers = await db.query('users', filters, {
      orderBy: { createdAt: 'desc' }
    })
    
    const tenants = isChina
      ? allUsers.filter((t: any) => {
          if (t.userType !== 'TENANT') return false
          const repId = t.representedById || t.tenantProfile?.representedById
          return repId === user.id
        })
      : allUsers.filter((t: any) => t.userType === 'TENANT')

    console.log(`Found ${tenants.length} tenants for agent ${user.id}`)

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
