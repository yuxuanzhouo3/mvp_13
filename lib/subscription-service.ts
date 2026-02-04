/**
 * 订阅与配额管理服务
 * 
 * 核心功能：
 * 1. 懒加载刷新机制（Lazy Reset）- 当用户请求时检查并刷新配额
 * 2. 订阅状态检查（自动降级）
 * 3. 配额扣除与验证
 */

import { getDatabaseAdapter, type UnifiedUser } from './db-adapter'
import { getAppRegion } from './db-adapter'

// 订阅级别配置
export const SUBSCRIPTION_TIERS = {
  FREE: {
    name: '免费版',
    dailyQuota: 10,
    monthlyQuota: 100,
    price: 0,
  },
  BASIC: {
    name: '基础版',
    dailyQuota: 50,
    monthlyQuota: 500,
    price: 9.99,
  },
  PREMIUM: {
    name: '高级版',
    dailyQuota: 200,
    monthlyQuota: 2000,
    price: 29.99,
  },
  ENTERPRISE: {
    name: '企业版',
    dailyQuota: -1, // 无限
    monthlyQuota: -1, // 无限
    price: 99.99,
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS

/**
 * 检查并刷新用户配额（懒加载刷新机制）
 * 如果 lastUsageDate 是昨天或更早，重置配额
 */
export async function checkAndRefreshQuota(userId: string): Promise<UnifiedUser> {
  const db = getDatabaseAdapter()
  const user = await db.findUserById(userId)
  
  if (!user) {
    throw new Error('用户不存在')
  }

  // 检查订阅是否过期，如果过期则降级为免费版
  await checkSubscriptionExpiry(user)

  // 获取更新后的用户信息
  let updatedUser = await db.findUserById(userId)
  if (!updatedUser) {
    throw new Error('用户不存在')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const lastUsageDate = updatedUser.lastUsageDate
    ? new Date(updatedUser.lastUsageDate)
    : null

  // 如果 lastUsageDate 是昨天或更早，重置每日配额
  if (!lastUsageDate || lastUsageDate < today) {
    const tier = (updatedUser.vipLevel || 'FREE') as SubscriptionTier
    const tierConfig = SUBSCRIPTION_TIERS[tier]
    
    await db.updateUser(userId, {
      dailyQuota: tierConfig.dailyQuota,
      lastUsageDate: today,
    })
    
    updatedUser = await db.findUserById(userId)
    if (!updatedUser) {
      throw new Error('用户不存在')
    }
  }

  // 检查是否需要重置每月配额（每月1号重置）
  const now = new Date()
  const lastMonth = updatedUser.updatedAt ? new Date(updatedUser.updatedAt) : new Date(0)
  
  if (now.getMonth() !== lastMonth.getMonth() || now.getFullYear() !== lastMonth.getFullYear()) {
    const tier = (updatedUser.vipLevel || 'FREE') as SubscriptionTier
    const tierConfig = SUBSCRIPTION_TIERS[tier]
    
    await db.updateUser(userId, {
      monthlyQuota: tierConfig.monthlyQuota,
    })
    
    updatedUser = await db.findUserById(userId)
    if (!updatedUser) {
      throw new Error('用户不存在')
    }
  }

  return updatedUser
}

/**
 * 检查订阅是否过期，如果过期则自动降级
 */
export async function checkSubscriptionExpiry(user: UnifiedUser): Promise<void> {
  const db = getDatabaseAdapter()
  
  // 如果用户是免费版，不需要检查
  if (!user.isPremium && (!user.vipLevel || user.vipLevel === 'FREE')) {
    return
  }

  const now = new Date()
  const subscriptionEndTime = user.subscriptionEndTime || user.premiumExpiry

  // 如果订阅已过期，降级为免费版
  if (subscriptionEndTime && new Date(subscriptionEndTime) < now) {
    const tierConfig = SUBSCRIPTION_TIERS.FREE
    
    await db.updateUser(user.id, {
      isPremium: false,
      vipLevel: 'FREE',
      dailyQuota: tierConfig.dailyQuota,
      monthlyQuota: tierConfig.monthlyQuota,
      subscriptionEndTime: null,
      premiumExpiry: null,
    })
  }
}

/**
 * 扣除配额（使用前调用）
 * @returns true 如果配额足够并已扣除，false 如果配额不足
 */
export async function deductQuota(
  userId: string,
  amount: number = 1
): Promise<{ success: boolean; message?: string }> {
  const user = await checkAndRefreshQuota(userId)

  // 检查每日配额
  if (user.dailyQuota !== undefined && user.dailyQuota !== -1) {
    if (user.dailyQuota < amount) {
      return {
        success: false,
        message: '今日配额已用完，请明天再试或升级会员',
      }
    }
  }

  // 检查每月配额
  if (user.monthlyQuota !== undefined && user.monthlyQuota !== -1) {
    if (user.monthlyQuota < amount) {
      return {
        success: false,
        message: '本月配额已用完，请下月再试或升级会员',
      }
    }
  }

  // 扣除配额
  const db = getDatabaseAdapter()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  await db.updateUser(userId, {
    dailyQuota: user.dailyQuota !== undefined && user.dailyQuota !== -1
      ? user.dailyQuota - amount
      : user.dailyQuota,
    monthlyQuota: user.monthlyQuota !== undefined && user.monthlyQuota !== -1
      ? user.monthlyQuota - amount
      : user.monthlyQuota,
    lastUsageDate: today,
  })

  return { success: true }
}

/**
 * 升级订阅
 */
export async function upgradeSubscription(
  userId: string,
  tier: SubscriptionTier,
  durationMonths: number = 1
): Promise<UnifiedUser> {
  const db = getDatabaseAdapter()
  const user = await db.findUserById(userId)
  
  if (!user) {
    throw new Error('用户不存在')
  }

  const tierConfig = SUBSCRIPTION_TIERS[tier]
  const now = new Date()
  const subscriptionEndTime = new Date(now)
  subscriptionEndTime.setMonth(subscriptionEndTime.getMonth() + durationMonths)

  const updatedUser = await db.updateUser(userId, {
    isPremium: tier !== 'FREE',
    vipLevel: tier,
    subscriptionEndTime,
    premiumExpiry: subscriptionEndTime,
    dailyQuota: tierConfig.dailyQuota,
    monthlyQuota: tierConfig.monthlyQuota,
  })

  return updatedUser
}

/**
 * 降级订阅
 */
export async function downgradeSubscription(
  userId: string,
  targetTier: SubscriptionTier = 'FREE'
): Promise<UnifiedUser> {
  const db = getDatabaseAdapter()
  const tierConfig = SUBSCRIPTION_TIERS[targetTier]

  const updatedUser = await db.updateUser(userId, {
    isPremium: targetTier !== 'FREE',
    vipLevel: targetTier,
    subscriptionEndTime: null,
    premiumExpiry: null,
    dailyQuota: tierConfig.dailyQuota,
    monthlyQuota: tierConfig.monthlyQuota,
  })

  return updatedUser
}

/**
 * 获取用户当前配额信息
 */
export async function getUserQuotaInfo(userId: string): Promise<{
  tier: SubscriptionTier
  dailyQuota: number
  monthlyQuota: number
  dailyRemaining: number
  monthlyRemaining: number
  subscriptionEndTime: Date | null
}> {
  const user = await checkAndRefreshQuota(userId)
  const tier = (user.vipLevel || 'FREE') as SubscriptionTier

  return {
    tier,
    dailyQuota: user.dailyQuota || 0,
    monthlyQuota: user.monthlyQuota || 0,
    dailyRemaining: user.dailyQuota || 0,
    monthlyRemaining: user.monthlyQuota || 0,
    subscriptionEndTime: user.subscriptionEndTime || null,
  }
}
