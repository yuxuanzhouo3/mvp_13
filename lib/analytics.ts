/**
 * 数据埋点系统
 * 
 * 核心功能：
 * 1. 记录关键事件（注册、支付、搜索等）
 * 2. 存储到对应的数据库（Supabase Events 表 或 CloudBase Events 集合）
 * 3. 统一的数据格式，便于后续统计分析
 */

import { getDatabaseAdapter, getAppRegion } from './db-adapter'

// 事件类型
export type EventType =
  | 'USER_SIGNUP'
  | 'USER_LOGIN'
  | 'PAYMENT'
  | 'SUBSCRIPTION_UPGRADE'
  | 'SUBSCRIPTION_DOWNGRADE'
  | 'AI_SEARCH'
  | 'PROPERTY_VIEW'
  | 'APPLICATION_SUBMIT'
  | 'DEPOSIT_CREATE'
  | 'DISPUTE_CREATE'
  | 'MESSAGE_SEND'
  | 'DEVICE_ACCESS'

// 事件数据接口
export interface EventData {
  type: EventType
  userId?: string
  region: 'global' | 'china'
  timestamp: Date
  metadata?: {
    amount?: number // 支付金额
    currency?: string // 货币类型
    subscriptionTier?: string // 订阅级别
    deviceType?: string // 设备类型 (Android, iOS, Web)
    platform?: string // 平台信息
    [key: string]: any // 允许其他任意字段
  }
}

/**
 * 记录事件（埋点）
 */
export async function trackEvent(event: {
  type: EventType
  userId?: string
  metadata?: Record<string, any>
}): Promise<void> {
  const region = getAppRegion()
  const db = getDatabaseAdapter()

  const eventData: EventData = {
    type: event.type,
    userId: event.userId,
    region,
    timestamp: new Date(),
    metadata: {
      ...event.metadata,
    },
  }

  try {
    // 存储到 Events 表/集合
    await db.create('events', eventData)
  } catch (error) {
    console.error('Failed to track event:', error)
    // 埋点失败不应该影响主业务流程，只记录错误
  }
}

/**
 * 记录支付事件
 */
export async function trackPayment(
  userId: string,
  amount: number,
  currency: string,
  paymentMethod: string,
  transactionId?: string
): Promise<void> {
  await trackEvent({
    type: 'PAYMENT',
    userId,
    metadata: {
      amount,
      currency,
      paymentMethod,
      transactionId,
    },
  })
}

/**
 * 记录订阅升级事件
 */
export async function trackSubscriptionUpgrade(
  userId: string,
  fromTier: string,
  toTier: string,
  amount: number
): Promise<void> {
  await trackEvent({
    type: 'SUBSCRIPTION_UPGRADE',
    userId,
    metadata: {
      fromTier,
      toTier,
      amount,
    },
  })
}

/**
 * 记录设备访问事件
 */
export async function trackDeviceAccess(
  userId: string,
  deviceType: string,
  platform: string
): Promise<void> {
  await trackEvent({
    type: 'DEVICE_ACCESS',
    userId,
    metadata: {
      deviceType,
      platform,
    },
  })
}

/**
 * 记录 AI 搜索事件
 */
export async function trackAISearch(
  userId: string,
  query: string,
  resultsCount?: number
): Promise<void> {
  await trackEvent({
    type: 'AI_SEARCH',
    userId,
    metadata: {
      query,
      resultsCount,
    },
  })
}
