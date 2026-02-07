/**
 * 数据库适配器层 - 统一接口，根据环境变量自动选择 Supabase 或 CloudBase
 * 
 * 核心思路：
 * - 读取 NEXT_PUBLIC_APP_REGION 环境变量
 * - "global" -> 使用 Prisma (Supabase PostgreSQL)
 * - "china" -> 使用 CloudBase SDK (NoSQL)
 * - 所有方法返回统一的数据格式
 */

import { prisma } from './db'
import { db as cloudbaseDb } from './cloudbase'

// 获取当前运行环境
export function getAppRegion(): 'global' | 'china' {
  const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
  return region === 'china' ? 'china' : 'global'
}

// 统一用户类型定义
export interface UnifiedUser {
  id: string
  email: string
  phone?: string | null
  password?: string // 仅用于内部操作
  name: string
  avatar?: string | null
  userType: string
  isPremium: boolean
  representedById?: string | null
  premiumExpiry?: Date | null
  vipLevel?: string // FREE, BASIC, PREMIUM, ENTERPRISE
  subscriptionEndTime?: Date | null
  lastUsageDate?: Date | null
  dailyQuota?: number
  monthlyQuota?: number
  createdAt: Date
  updatedAt: Date
}

// 数据库适配器接口
export interface DatabaseAdapter {
  // 用户操作
  findUserByEmail(email: string): Promise<UnifiedUser | null>
  findUserById(id: string): Promise<UnifiedUser | null>
  createUser(data: {
    email: string
    password: string
    name: string
    phone?: string
    userType?: string
    representedById?: string
  }): Promise<UnifiedUser>
  updateUser(id: string, data: Partial<UnifiedUser>): Promise<UnifiedUser>
  
  // 通用查询方法
  query<T = any>(collection: string, filters?: any, options?: any): Promise<T[]>
  findById<T = any>(collection: string, id: string): Promise<T | null>
  create<T = any>(collection: string, data: any): Promise<T>
  update<T = any>(collection: string, id: string, data: any): Promise<T>
  delete(collection: string, id: string): Promise<boolean>
  
  // 统计方法
  count(collection: string, filters?: any): Promise<number>
}

// Supabase (Prisma) 适配器实现
export class SupabaseAdapter implements DatabaseAdapter {
  async findUserByEmail(email: string): Promise<UnifiedUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          tenantProfile: true,
          landlordProfile: true,
        },
      })
      
      if (!user) return null
      
      return this.mapPrismaUserToUnified(user)
    } catch (error: any) {
      const errorMsg = String(error?.message || '')
      const lower = errorMsg.toLowerCase()
      
      console.error('[SupabaseAdapter] 查询用户失败:', {
        email,
        error: errorMsg,
        code: error?.code
      })
      
      // 检查是否是连接问题
      const isConnectionError = 
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler') ||
        lower.includes('P1001') || // Prisma 连接错误代码
        lower.includes('P1017') || // Prisma 连接关闭错误代码
        lower.includes('P1000') || // Prisma 认证错误
        lower.includes('P1001') || // Prisma 无法连接到数据库
        error?.code === 'P1001' ||
        error?.code === 'P1017' ||
        error?.code === 'P1000'
      
      if (isConnectionError) {
        console.error('[SupabaseAdapter] 数据库连接错误详情:', {
          error: errorMsg,
          code: error?.code,
          meta: error?.meta
        })
        
        // 强制抛出详细错误，方便调试
        // if (process.env.NODE_ENV === 'development') {
          const maskedUrl = (process.env.DATABASE_URL || '').replace(/:[^:]*@/, ':****@')
          
          // 构建详细的调试信息
          const debugInfo = `(URL: ${maskedUrl})`
          const errorDetails = JSON.stringify({
            name: error.name,
            code: error.code,
            meta: error.meta,
            message: error.message,
            stack: error.stack
          }, null, 2)
          
          if (process.env.NODE_ENV === 'development' || true) { // 强制开启调试信息
             throw new Error(`Database connection failed details: ${errorDetails} ${debugInfo}`)
          }
        // }
        
        // throw new Error('Database connection failed, please try again later')
      }
      
      // 其他错误重新抛出
      throw error
    }
  }

  async findUserById(id: string): Promise<UnifiedUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          tenantProfile: true,
          landlordProfile: true,
        },
      })
      
      if (!user) return null
      
      return this.mapPrismaUserToUnified(user)
    } catch (error: any) {
      const errorMsg = String(error?.message || '')
      const lower = errorMsg.toLowerCase()
      
      console.error('[SupabaseAdapter] 查询用户失败:', {
        id,
        error: errorMsg,
        code: error?.code
      })
      
      // 检查是否是连接问题
      if (
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler') ||
        lower.includes('P1001') ||
        lower.includes('P1017')
      ) {
        // 在开发环境下抛出详细错误
        // if (process.env.NODE_ENV === 'development') {
          const maskedUrl = (process.env.DATABASE_URL || '').replace(/:[^:]*@/, ':****@')
          throw new Error(`Database connection failed: ${errorMsg} (URL: ${maskedUrl})`)
        // }
        // throw new Error('Database connection failed, please try again later')
      }
      
      throw error
    }
  }

  async createUser(data: {
    email: string
    password: string
    name: string
    phone?: string
    userType?: string
    representedById?: string
  }): Promise<UnifiedUser> {
    // 如果密码为空（Supabase 用户），使用随机密码占位
    const password = data.password || `supabase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 构建用户数据，phone 字段只有在有值时才添加
    const userData: any = {
      email: data.email,
      password: password,
      name: data.name,
      userType: data.userType || 'TENANT',
      isPremium: false,
      vipLevel: 'FREE',
      dailyQuota: 10,
      monthlyQuota: 100,
      ...(data.userType === 'TENANT' && {
        tenantProfile: { 
          create: {
            // ...(data.representedById ? { representedById: data.representedById } : {})
          } 
        }
      }),
      ...(data.userType === 'LANDLORD' && {
        landlordProfile: { 
          create: {
            // ...(data.representedById ? { representedById: data.representedById } : {})
          } 
        }
      }),
    }
    
    // 只有当 phone 有值时才添加该字段（避免唯一索引冲突）
    if (data.phone && data.phone.trim() !== '') {
      userData.phone = data.phone.trim()
    }
    
    const user = await prisma.user.create({
      data: userData,
      include: {
        tenantProfile: true,
        landlordProfile: true,
      },
    })
    
    return this.mapPrismaUserToUnified(user)
  }

  async updateUser(id: string, data: Partial<UnifiedUser>): Promise<UnifiedUser> {
    const updateData: any = {}
    
    if (data.email !== undefined) updateData.email = data.email
    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.avatar !== undefined) updateData.avatar = data.avatar
    if (data.userType !== undefined) updateData.userType = data.userType
    if (data.isPremium !== undefined) updateData.isPremium = data.isPremium
    if (data.premiumExpiry !== undefined) updateData.premiumExpiry = data.premiumExpiry
    
    // Prisma 不直接在 User 表存储 representedById，需要更新关联的 Profile
    // 我们在 prisma.user.update 之后单独处理
    
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        tenantProfile: true,
        landlordProfile: true,
      },
    })

    // 处理 representedById 更新
    // if (data.representedById !== undefined) {
    //   if (user.userType === 'TENANT') {
    //     await prisma.tenantProfile.upsert({
    //       where: { userId: id },
    //       update: { representedById: data.representedById },
    //       create: { userId: id, representedById: data.representedById },
    //     })
    //   } else if (user.userType === 'LANDLORD') {
    //     await prisma.landlordProfile.upsert({
    //       where: { userId: id },
    //       update: { representedById: data.representedById },
    //       create: { userId: id, representedById: data.representedById },
    //     })
    //   }
    //   
    //   // 重新获取包含最新 profile 的用户信息
    //   return this.findUserById(id) as Promise<UnifiedUser>
    // }
    
    return this.mapPrismaUserToUnified(user)
  }

  async query<T = any>(collection: string, filters?: any, options?: any): Promise<T[]> {
    // 将 collection 名称映射到 Prisma model
    const modelMap: Record<string, any> = {
      'users': prisma.user,
      'properties': prisma.property,
      'applications': prisma.application,
      'payments': prisma.payment,
      'deposits': prisma.deposit,
      'disputes': prisma.dispute,
      'messages': prisma.message,
      'savedProperties': prisma.savedProperty,
      'notifications': prisma.notification,
      'events': (prisma as any).event || null, // Events 表（如果已添加）
      'agentProfiles': (prisma as any).agentProfile,
      'tenantProfiles': prisma.tenantProfile,
      'landlordProfiles': prisma.landlordProfile,
    }
    
    const model = modelMap[collection]
    if (!model) {
      // 如果 Events 表不存在，使用原始 SQL 查询（降级方案）
      if (collection === 'events') {
        // 使用 $queryRaw 作为降级方案
        const whereClause = filters ? this.buildWhereClause(filters) : ''
        const sql = `SELECT * FROM "Event" ${whereClause} ORDER BY "timestamp" DESC LIMIT 100`
        return prisma.$queryRawUnsafe(sql) as Promise<T[]>
      }
      throw new Error(`Collection ${collection} not found in Prisma schema`)
    }
    
    // 构建 Prisma 查询参数
    const queryOptions: any = {}
    
    // 如果有 filters，包装成 where 条件
    if (filters && Object.keys(filters).length > 0) {
      queryOptions.where = this.normalizeFilters(filters)
    }
    
    // 处理排序
    if (options?.orderBy) {
      queryOptions.orderBy = options.orderBy
    } else {
      // 默认按创建时间倒序
      queryOptions.orderBy = { createdAt: 'desc' }
    }
    
    // 处理分页
    if (options?.skip !== undefined) {
      queryOptions.skip = options.skip
    }
    if (options?.take !== undefined) {
      queryOptions.take = options.take
    }
    
    return model.findMany(queryOptions) as Promise<T[]>
  }

  private normalizeFilters(filters: any): any {
    const newFilters: any = {}
    
    for (const key in filters) {
      const value = filters[key]
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // 递归处理嵌套对象
        newFilters[key] = this.normalizeFilters(value)
        
        // 处理 MongoDB 风格的操作符
        if (newFilters[key].$gte !== undefined) {
          newFilters[key].gte = newFilters[key].$gte
          delete newFilters[key].$gte
        }
        if (newFilters[key].$lte !== undefined) {
          newFilters[key].lte = newFilters[key].$lte
          delete newFilters[key].$lte
        }
        if (newFilters[key].$gt !== undefined) {
          newFilters[key].gt = newFilters[key].$gt
          delete newFilters[key].$gt
        }
        if (newFilters[key].$lt !== undefined) {
          newFilters[key].lt = newFilters[key].$lt
          delete newFilters[key].$lt
        }
      } else {
        newFilters[key] = value
      }
    }
    
    // 顶层操作符处理 (如 { timestamp: { $gte: ... } } 的内层已经在递归中处理了)
    // 这里处理的是如果 filters 本身就是操作符对象的情况（不太常见，通常是字段: { 操作符: 值 }）
    if (newFilters.$gte !== undefined) {
      newFilters.gte = newFilters.$gte
      delete newFilters.$gte
    }
    if (newFilters.$lte !== undefined) {
      newFilters.lte = newFilters.$lte
      delete newFilters.$lte
    }
    
    return newFilters
  }

  private buildWhereClause(filters: any): string {
    // 简单的 WHERE 子句构建（可以根据需要扩展）
    const conditions: string[] = []
    if (filters.type) {
      conditions.push(`"type" = '${filters.type}'`)
    }
    if (filters.userId) {
      conditions.push(`"userId" = '${filters.userId}'`)
    }
    if (filters.timestamp && filters.timestamp.$gte) {
      conditions.push(`"timestamp" >= '${filters.timestamp.$gte}'`)
    }
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  }

  async findById<T = any>(collection: string, id: string): Promise<T | null> {
    const modelMap: Record<string, any> = {
      'users': prisma.user,
      'properties': prisma.property,
      'applications': prisma.application,
      'payments': prisma.payment,
      'deposits': prisma.deposit,
      'disputes': prisma.dispute,
      'messages': prisma.message,
      'savedProperties': prisma.savedProperty,
      'notifications': prisma.notification,
      'events': (prisma as any).event || null,
      'agentProfiles': (prisma as any).agentProfile,
      'tenantProfiles': prisma.tenantProfile,
      'landlordProfiles': prisma.landlordProfile,
    }
    
    const model = modelMap[collection]
    if (!model) return null
    
    return model.findUnique({ where: { id } }) as Promise<T | null>
  }

  async create<T = any>(collection: string, data: any): Promise<T> {
    const modelMap: Record<string, any> = {
      'users': prisma.user,
      'properties': prisma.property,
      'applications': prisma.application,
      'payments': prisma.payment,
      'deposits': prisma.deposit,
      'disputes': prisma.dispute,
      'messages': prisma.message,
      'savedProperties': prisma.savedProperty,
      'notifications': prisma.notification,
      'events': (prisma as any).event || null, // Events 表（如果已添加）
      'agentProfiles': (prisma as any).agentProfile,
      'tenantProfiles': prisma.tenantProfile,
      'landlordProfiles': prisma.landlordProfile,
    }
    
    const model = modelMap[collection]
    if (!model) {
      // 如果 Events 表不存在，使用原始 SQL 插入（降级方案）
      if (collection === 'events') {
        const id = data.id || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const sql = `
          INSERT INTO "Event" ("id", "type", "userId", "region", "timestamp", "metadata")
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `
        return prisma.$queryRawUnsafe(
          sql,
          id,
          data.type,
          data.userId || null,
          data.region,
          data.timestamp || new Date(),
          JSON.stringify(data.metadata || {})
        ) as Promise<T>
      }
      throw new Error(`Collection ${collection} not found in Prisma schema`)
    }
    
    return model.create({ data }) as Promise<T>
  }

  async update<T = any>(collection: string, id: string, data: any): Promise<T> {
    const modelMap: Record<string, any> = {
      'users': prisma.user,
      'properties': prisma.property,
      'applications': prisma.application,
      'payments': prisma.payment,
      'deposits': prisma.deposit,
      'disputes': prisma.dispute,
      'messages': prisma.message,
      'savedProperties': prisma.savedProperty,
      'notifications': prisma.notification,
      'events': (prisma as any).event || null,
      'agentProfiles': (prisma as any).agentProfile,
      'tenantProfiles': prisma.tenantProfile,
      'landlordProfiles': prisma.landlordProfile,
    }
    
    const model = modelMap[collection]
    if (!model) {
      throw new Error(`Collection ${collection} not found in Prisma schema`)
    }
    
    return model.update({ where: { id }, data }) as Promise<T>
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const modelMap: Record<string, any> = {
      'users': prisma.user,
      'properties': prisma.property,
      'applications': prisma.application,
      'payments': prisma.payment,
      'deposits': prisma.deposit,
      'disputes': prisma.dispute,
      'messages': prisma.message,
      'savedProperties': prisma.savedProperty,
      'notifications': prisma.notification,
      'events': (prisma as any).event || null,
      'agentProfiles': (prisma as any).agentProfile,
      'tenantProfiles': prisma.tenantProfile,
      'landlordProfiles': prisma.landlordProfile,
    }
    
    const model = modelMap[collection]
    if (!model) return false
    
    await model.delete({ where: { id } })
    return true
  }

  async count(collection: string, filters?: any): Promise<number> {
    const modelMap: Record<string, any> = {
      'users': prisma.user,
      'properties': prisma.property,
      'applications': prisma.application,
      'payments': prisma.payment,
      'deposits': prisma.deposit,
      'disputes': prisma.dispute,
      'messages': prisma.message,
      'savedProperties': prisma.savedProperty,
      'notifications': prisma.notification,
      'events': (prisma as any).event || null, // Events 表（如果已添加）
      'agentProfiles': (prisma as any).agentProfile,
      'tenantProfiles': prisma.tenantProfile,
      'landlordProfiles': prisma.landlordProfile,
    }
    
    const model = modelMap[collection]
    if (!model) {
      // 如果 Events 表不存在，使用原始 SQL 计数（降级方案）
      if (collection === 'events') {
        const whereClause = filters ? this.buildWhereClause(filters) : ''
        const sql = `SELECT COUNT(*) as count FROM "Event" ${whereClause}`
        const result = await prisma.$queryRawUnsafe(sql) as any[]
        return result[0]?.count || 0
      }
      return 0
    }
    
    const where = filters ? this.normalizeFilters(filters) : {}
    return model.count({ where })
  }

  private mapPrismaUserToUnified(user: any): UnifiedUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      password: user.password,
      name: user.name,
      avatar: user.avatar,
      userType: user.userType,
      isPremium: user.isPremium,
      premiumExpiry: user.premiumExpiry,
      vipLevel: user.isPremium ? 'PREMIUM' : 'FREE',
      subscriptionEndTime: user.premiumExpiry,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      // representedById: user.tenantProfile?.representedById || user.landlordProfile?.representedById || null,
    }
  }
}

// CloudBase 适配器实现
export class CloudBaseAdapter implements DatabaseAdapter {
  async findUserByEmail(email: string): Promise<UnifiedUser | null> {
    const result = await cloudbaseDb
      .collection('users')
      .where({ email })
      .get()
    
    if (result.data.length === 0) return null
    
    return this.mapCloudBaseUserToUnified(result.data[0])
  }

  async findUserById(id: string): Promise<UnifiedUser | null> {
    const result = await cloudbaseDb
      .collection('users')
      .doc(String(id))
      .get()
    
    if (!result.data) return null
    
    // CloudBase SDK 的 doc(id).get() 返回的 result.data 是一个数组
    // 需要取数组的第一项
    const userData = Array.isArray(result.data) ? result.data[0] : result.data
    if (!userData) return null
    
    return this.mapCloudBaseUserToUnified(userData)
  }

  async createUser(data: {
    email: string
    password: string
    name: string
    phone?: string
    userType?: string
    representedById?: string
  }): Promise<UnifiedUser> {
    // 构建用户数据，phone 字段只有在有值时才添加（避免唯一索引冲突）
    const userData: any = {
      email: data.email,
      password: data.password,
      name: data.name,
      userType: data.userType || 'TENANT',
      isPremium: false,
      vipLevel: 'FREE',
      dailyQuota: 10, // 免费用户每日配额
      monthlyQuota: 100, // 免费用户每月配额
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(data.representedById ? { representedById: data.representedById } : {})
    }
    
    // 只有当 phone 有值时才添加该字段（避免 CloudBase 唯一索引冲突）
    // CloudBase 的唯一索引不允许多个 null 值，所以不设置该字段而不是设置为 null
    if (data.phone && data.phone.trim() !== '') {
      userData.phone = data.phone.trim()
    }
    
    const result = await cloudbaseDb
      .collection('users')
      .add(userData)
    
    return {
      ...userData,
      id: result.id,
      premiumExpiry: null,
      subscriptionEndTime: null,
    }
  }

  async updateUser(id: string, data: Partial<UnifiedUser>): Promise<UnifiedUser> {
    const updateData: any = {
      updatedAt: new Date(),
    }
    
    if (data.email !== undefined) updateData.email = data.email
    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.avatar !== undefined) updateData.avatar = data.avatar
    if (data.userType !== undefined) updateData.userType = data.userType
    if (data.isPremium !== undefined) updateData.isPremium = data.isPremium
    if (data.premiumExpiry !== undefined) updateData.premiumExpiry = data.premiumExpiry
    if (data.vipLevel !== undefined) updateData.vipLevel = data.vipLevel
    if (data.subscriptionEndTime !== undefined) updateData.subscriptionEndTime = data.subscriptionEndTime
    if (data.lastUsageDate !== undefined) updateData.lastUsageDate = data.lastUsageDate
    if (data.dailyQuota !== undefined) updateData.dailyQuota = data.dailyQuota
    if (data.monthlyQuota !== undefined) updateData.monthlyQuota = data.monthlyQuota
    if (data.representedById !== undefined) updateData.representedById = data.representedById
    
    await cloudbaseDb
      .collection('users')
      .doc(String(id))
      .update(updateData)
    
    const updated = await this.findUserById(id)
    if (!updated) throw new Error('User not found after update')
    
    return updated
  }

  async query<T = any>(collection: string, filters?: any, options?: any): Promise<T[]> {
    let query = cloudbaseDb.collection(collection)
    
    // 简单的过滤实现（只处理精确匹配，忽略以 _ 开头的过滤标记）
    if (filters) {
      Object.keys(filters).forEach(key => {
        // 忽略以 _ 开头的过滤标记（这些是用于内存过滤的）
        if (!key.startsWith('_')) {
          const value = filters[key]
          // 如果是对象（如 { gte: 100 }），需要特殊处理
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            // CloudBase 不支持复杂查询，这里只处理简单的相等匹配
            // 复杂查询会在调用后手动过滤
            if (value.gte !== undefined) {
              // 对于 >= 查询，先获取所有数据，然后在内存中过滤
              // 这里先不添加条件，稍后在内存中过滤
            } else {
              query = query.where({ [key]: value })
            }
          } else {
            query = query.where({ [key]: value })
          }
        }
      })
    }
    
    const result = await query.get()
    
    // CloudBase 返回的数据只有 _id，需要映射为 id 以便前端使用
    return result.data.map((item: any) => ({
      ...item,
      id: item.id || item._id, // 优先使用已有的 id，如果没有则使用 _id
    })) as T[]
  }

  async findById<T = any>(collection: string, id: string): Promise<T | null> {
    const result = await cloudbaseDb
      .collection(collection)
      .doc(String(id))
      .get()
    
    if (!result.data) return null
    
    // CloudBase SDK 的 doc(id).get() 返回的 result.data 是一个数组
    // 需要取数组的第一项
    const data = Array.isArray(result.data) ? result.data[0] : result.data
    
    if (!data) return null

    // 映射 _id 到 id
    return {
      ...data,
      id: data.id || data._id,
    } as T
  }

  async create<T = any>(collection: string, data: any): Promise<T> {
    // 处理日期字段，确保是Date对象或ISO字符串
    const processedData: any = { ...data }
    
    // 转换Date对象为ISO字符串（CloudBase需要）
    Object.keys(processedData).forEach(key => {
      if (processedData[key] instanceof Date) {
        processedData[key] = processedData[key].toISOString()
      }
    })
    
    // 确保有创建和更新时间
    if (!processedData.createdAt) {
      processedData.createdAt = new Date().toISOString()
    }
    if (!processedData.updatedAt) {
      processedData.updatedAt = new Date().toISOString()
    }
    
    const result = await cloudbaseDb
      .collection(collection)
      .add(processedData)
    
    return {
      ...processedData,
      id: result.id,
      _id: result.id,
    } as T
  }

  async update<T = any>(collection: string, id: string, data: any): Promise<T> {
    // 处理日期字段，确保是Date对象或ISO字符串
    const processedData: any = { ...data }
    
    // 转换Date对象为ISO字符串（CloudBase需要）
    Object.keys(processedData).forEach(key => {
      if (processedData[key] instanceof Date) {
        processedData[key] = processedData[key].toISOString()
      }
    })
    
    // 确保有更新时间
    processedData.updatedAt = new Date().toISOString()
    
    await cloudbaseDb
      .collection(collection)
      .doc(String(id))
      .update(processedData)
    
    return this.findById<T>(collection, id) as Promise<T>
  }

  async delete(collection: string, id: string): Promise<boolean> {
    await cloudbaseDb
      .collection(collection)
      .doc(String(id))
      .remove()
    
    return true
  }

  async count(collection: string, filters?: any): Promise<number> {
    let query = cloudbaseDb.collection(collection)
    
    if (filters) {
      Object.keys(filters).forEach(key => {
        query = query.where({ [key]: filters[key] })
      })
    }
    
    const result = await query.count()
    return result.total
  }

  private mapCloudBaseUserToUnified(user: any): UnifiedUser {
    return {
      id: user._id || user.id,
      email: user.email,
      phone: user.phone,
      password: user.password,
      name: user.name,
      avatar: user.avatar,
      userType: user.userType,
      isPremium: user.isPremium || false,
      premiumExpiry: user.premiumExpiry ? new Date(user.premiumExpiry) : null,
      vipLevel: user.vipLevel || (user.isPremium ? 'PREMIUM' : 'FREE'),
      subscriptionEndTime: user.subscriptionEndTime ? new Date(user.subscriptionEndTime) : null,
      lastUsageDate: user.lastUsageDate ? new Date(user.lastUsageDate) : null,
      dailyQuota: user.dailyQuota || 10,
      monthlyQuota: user.monthlyQuota || 100,
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
      representedById: user.representedById || null,
    }
  }
}

// 导出统一的数据库适配器实例
let adapterInstance: DatabaseAdapter | null = null
let adapterRegion: 'global' | 'china' | null = null

export function getDatabaseAdapter(): DatabaseAdapter {
  const region = getAppRegion()
  if (adapterInstance && adapterRegion === region) {
    return adapterInstance
  }
  
  if (region === 'china') {
    adapterInstance = new CloudBaseAdapter()
  } else {
    adapterInstance = new SupabaseAdapter()
  }
  adapterRegion = region
  
  return adapterInstance
}

// 便捷导出
export const db = getDatabaseAdapter()

/**
 * 按指定 region 创建一个新的适配器实例（不使用单例）。
 * 用于在 global 环境下 Prisma 连接失败时的降级（例如本地网络无法连 Supabase）。
 */
export function createDatabaseAdapter(region: 'global' | 'china'): DatabaseAdapter {
  return region === 'china' ? new CloudBaseAdapter() : new SupabaseAdapter()
}
