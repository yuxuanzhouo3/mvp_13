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

    // 构建查询条件：只获取属于当前中介的租客
    const filters: any = {
      userType: 'TENANT'
    }
    
    // 数据隔离 logic
    if (process.env.NEXT_PUBLIC_APP_REGION !== 'china') {
      // Supabase (Global): 嵌套查询 TenantProfile
      filters.tenantProfile = {
        representedById: user.id
      }
    } else {
      // CloudBase (China): 直接查询根字段
      filters.representedById = user.id
    }

    // Get tenants
    const allUsers = await db.query('users', filters, {
      orderBy: { createdAt: 'desc' }
    })
    
    // 内存过滤（双重保障，兼容不同数据库行为）
    const tenants = allUsers.filter((t: any) => {
      if (t.userType !== 'TENANT') return false
      
      // 检查 representedById (可能在根对象或 tenantProfile 中)
      const repId = t.representedById || t.tenantProfile?.representedById
      return repId === user.id
    })

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
