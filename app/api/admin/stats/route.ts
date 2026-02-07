/**
 * 后台统计 API
 * 
 * 功能：
 * 1. 聚合国内外数据统计
 * 2. 日活跃/月活跃/总用户
 * 3. 日收入/月收入/总收入
 * 4. 日订阅/月订阅/总订阅及类型
 * 5. 支付账单统计
 * 6. 设备使用统计
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter, getAppRegion, createDatabaseAdapter } from '@/lib/db-adapter'
import jwt from 'jsonwebtoken'

// 检查是否为管理员
async function isAdmin(user: any): Promise<boolean> {
  // 方式1：检查是否是管理员 token（role === 'admin'）
  if (user.role === 'admin') {
    return true
  }

  // 方式2：通过环境变量检查
  if (process.env.ADMIN_USER_IDS?.split(',').includes(user.id)) {
    return true
  }

  // 方式3：从数据库检查用户类型
  try {
    const db = getDatabaseAdapter()
    const dbUser = await db.findUserById(user.id)
    if (dbUser?.userType === 'ADMIN') {
      return true
    }
  } catch (error) {
    console.error('Error checking admin status:', error)
  }

  return false
}

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    // 先尝试获取管理员 token（独立登录系统）
    const authHeader = request.headers.get('authorization')
    let user: any = null
    let isAdminUser = false

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        // 尝试解析管理员 token
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'your-secret-key'
        ) as any
        
        if (decoded.role === 'admin') {
          user = decoded
          isAdminUser = true
        } else {
          // 尝试普通用户认证
          user = await getCurrentUser(request)
        }
      } catch (error) {
        // Token 无效，尝试普通用户认证
        user = await getCurrentUser(request)
      }
    } else {
      user = await getCurrentUser(request)
    }

    // 检查管理员权限
    if (!user) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      )
    }

    if (!isAdminUser) {
      isAdminUser = await isAdmin(user)
    }

    if (!isAdminUser) {
      return NextResponse.json(
        { error: '无权限访问' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const region = searchParams.get('region') // 'global', 'china', 'all'
    const period = searchParams.get('period') || 'day' // 'day', 'month', 'all'

    // 如果 region 是 'all'，需要同时查询两个数据库
    if (region === 'all') {
      const [globalStats, chinaStats] = await Promise.all([
        getStatsForRegion('global', period as 'month' | 'day' | 'all'),
        getStatsForRegion('china', period as 'month' | 'day' | 'all'),
      ])

      return NextResponse.json({
        global: globalStats,
        china: chinaStats,
        total: {
          users: globalStats.users.total + chinaStats.users.total,
          revenue: globalStats.revenue.total + chinaStats.revenue.total,
          subscriptions: globalStats.subscriptions.total + chinaStats.subscriptions.total,
          devices: mergeDeviceStats(globalStats.devices, chinaStats.devices),
        },
      })
    }

    // 查询指定区域的数据
    const targetRegion = region || getAppRegion()
    const stats = await getStatsForRegion(targetRegion as 'global' | 'china', period as 'month' | 'day' | 'all')

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: '获取统计失败', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 获取指定区域的统计数据
 */
async function getStatsForRegion(
  region: 'global' | 'china',
  period: 'day' | 'month' | 'all'
): Promise<any> {
  // 为指定区域创建独立的数据库适配器实例，避免修改环境变量
  const db = createDatabaseAdapter(region)
  try {
    const now = new Date()

    // 计算时间范围
    let startDate: Date | null = null
    if (period === 'day') {
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // 1. 用户统计
    const totalUsers = await db.count('users')
    const activeUsers = await getActiveUsers(db, startDate, period)

    // 2. 收入统计
    const revenue = await getRevenueStats(db, startDate, period)

    // 3. 订阅统计
    const subscriptions = await getSubscriptionStats(db, startDate, period)

    // 4. 设备统计
    const devices = await getDeviceStats(db, startDate, period)

    return {
      region,
      period,
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      revenue,
      subscriptions,
      devices,
    }
  } finally {
    // 无需恢复环境变量
  }
}

/**
 * 获取活跃用户数
 */
async function getActiveUsers(
  db: any,
  startDate: Date | null,
  period: string
): Promise<{ daily: number; monthly: number; total: number }> {
  if (!startDate) {
    // 查询所有时间
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

    // 查询今日活跃（有事件记录的用户）
    const dailyActive = await db.count('events', {
      timestamp: { $gte: today },
    })

    // 查询本月活跃
    const monthlyActive = await db.count('events', {
      timestamp: { $gte: monthStart },
    })

    return {
      daily: dailyActive,
      monthly: monthlyActive,
      total: await db.count('users'),
    }
  }

  // 根据时间范围查询
  const count = await db.count('events', {
    timestamp: { $gte: startDate },
  })

  return {
    daily: period === 'day' ? count : 0,
    monthly: period === 'month' ? count : 0,
    total: await db.count('users'),
  }
}

/**
 * 获取收入统计
 */
async function getRevenueStats(
  db: any,
  startDate: Date | null,
  period: string
): Promise<{ daily: number; monthly: number; total: number; currency: string }> {
  // 查询支付事件
  const paymentEvents = await db.query('events', {
    type: 'PAYMENT',
    ...(startDate && { timestamp: { $gte: startDate } }),
  })

  let daily = 0
  let monthly = 0
  let total = 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  paymentEvents.forEach((event: any) => {
    const amount = event.metadata?.amount || 0
    const eventDate = new Date(event.timestamp)

    total += amount

    if (eventDate >= today) {
      daily += amount
    }

    if (eventDate >= monthStart) {
      monthly += amount
    }
  })

  return {
    daily,
    monthly,
    total,
    currency: getAppRegion() === 'china' ? 'CNY' : 'USD',
  }
}

/**
 * 获取订阅统计
 */
async function getSubscriptionStats(
  db: any,
  startDate: Date | null,
  period: string
): Promise<{
  daily: number
  monthly: number
  total: number
  byTier: Record<string, number>
}> {
  // 查询订阅升级事件
  const upgradeEvents = await db.query('events', {
    type: 'SUBSCRIPTION_UPGRADE',
    ...(startDate && { timestamp: { $gte: startDate } }),
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  let daily = 0
  let monthly = 0
  const byTier: Record<string, number> = {}

  upgradeEvents.forEach((event: any) => {
    const eventDate = new Date(event.timestamp)
    const tier = event.metadata?.toTier || 'UNKNOWN'

    byTier[tier] = (byTier[tier] || 0) + 1

    if (eventDate >= today) {
      daily++
    }

    if (eventDate >= monthStart) {
      monthly++
    }
  })

  // 查询当前所有订阅用户
  const allUsers = await db.query('users', {})
  const total = allUsers.filter((u: any) => u.isPremium || u.vipLevel !== 'FREE').length

  return {
    daily,
    monthly,
    total,
    byTier,
  }
}

/**
 * 获取设备统计
 */
async function getDeviceStats(
  db: any,
  startDate: Date | null,
  period: string
): Promise<Record<string, number>> {
  const deviceEvents = await db.query('events', {
    type: 'DEVICE_ACCESS',
    ...(startDate && { timestamp: { $gte: startDate } }),
  })

  const stats: Record<string, number> = {}

  deviceEvents.forEach((event: any) => {
    const deviceType = event.metadata?.deviceType || 'UNKNOWN'
    stats[deviceType] = (stats[deviceType] || 0) + 1
  })

  return stats
}

/**
 * 合并设备统计
 */
function mergeDeviceStats(
  global: Record<string, number>,
  china: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...global }

  Object.keys(china).forEach((key) => {
    merged[key] = (merged[key] || 0) + china[key]
  })

  return merged
}
