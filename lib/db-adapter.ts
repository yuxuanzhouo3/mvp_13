/**
 * 数据库适配器层 - 统一接口，根据环境变量自动选择 Supabase 或 CloudBase
 * 
 * 核心思路：
 * - 读取 NEXT_PUBLIC_APP_REGION 环境变量
 * - "global" -> 使用 Prisma (Supabase PostgreSQL)
 * - "china" -> 使用 CloudBase SDK (NoSQL)
 * - 所有方法返回统一的数据格式
 */

import { prisma, prismaDirect, withPrismaRetry } from './db'
import { db as cloudbaseDb } from './cloudbase'

const withTimeoutMs = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms))
  ])

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
    const query = () =>
      prisma.user.findUnique({
        where: { email },
        include: {
          tenantProfile: true,
          landlordProfile: true,
        },
      })
    try {
      // 优先直连，直连不可达时回退到 pooler（带重试）
      if (prismaDirect) {
        try {
          const user = await withTimeoutMs(
            prismaDirect.user.findUnique({
              where: { email },
              include: {
                tenantProfile: true,
                landlordProfile: true,
              },
            }),
            18000
          )
          if (user) return this.mapPrismaUserToUnified(user)
          return null
        } catch (directErr: any) {
          const msg = String(directErr?.message || '').toLowerCase()
          const directUnreachable =
            msg.includes("can't reach") ||
            msg.includes('connection') ||
            msg.includes('timeout') ||
            msg.includes('econnrefused') ||
            msg.includes('enotfound')
          if (directUnreachable) {
            console.warn('[SupabaseAdapter] Direct DB unreachable, falling back to pooler:', directErr?.message)
            const user = await withPrismaRetry(query, 3, 20000)
            if (!user) return null
            return this.mapPrismaUserToUnified(user)
          }
          throw directErr
        }
      }
      const user = await withPrismaRetry(query, 3, 20000)
      if (!user) return null
      return this.mapPrismaUserToUnified(user)
    } catch (error: any) {
      const errorMsg = String(error?.message || '')
      const lower = errorMsg.toLowerCase()
      console.error('[SupabaseAdapter] 查询用户失败:', { email, error: errorMsg, code: error?.code })
      const isConnectionError =
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes('check out') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler') ||
        lower.includes('pool') ||
        lower.includes('P1001') ||
        lower.includes('P1017') ||
        lower.includes('P1000') ||
        error?.code === 'P1001' ||
        error?.code === 'P1017' ||
        error?.code === 'P1000'
      if (isConnectionError) {
        throw new Error('Database connection failed, please try again later')
      }
      throw error
    }
  }

  async findUserById(id: string): Promise<UnifiedUser | null> {
    const query = () =>
      prisma.user.findUnique({
        where: { id },
        include: {
          tenantProfile: true,
          landlordProfile: true,
        },
      })
    try {
      if (prismaDirect) {
        try {
          const user = await withTimeoutMs(
            prismaDirect.user.findUnique({
              where: { id },
              include: {
                tenantProfile: true,
                landlordProfile: true,
              },
            }),
            18000
          )
          if (user) return this.mapPrismaUserToUnified(user)
          return null
        } catch (directErr: any) {
          const msg = String(directErr?.message || '').toLowerCase()
          const directUnreachable =
            msg.includes("can't reach") ||
            msg.includes('connection') ||
            msg.includes('timeout') ||
            msg.includes('econnrefused') ||
            msg.includes('enotfound')
          if (directUnreachable) {
            console.warn('[SupabaseAdapter] Direct DB unreachable, falling back to pooler:', directErr?.message)
            const user = await withPrismaRetry(query, 3, 20000)
            if (!user) return null
            return this.mapPrismaUserToUnified(user)
          }
          throw directErr
        }
      }
      const user = await withPrismaRetry(query, 3, 20000)
      if (!user) return null
      return this.mapPrismaUserToUnified(user)
    } catch (error: any) {
      const errorMsg = String(error?.message || '')
      const lower = errorMsg.toLowerCase()
      console.error('[SupabaseAdapter] 查询用户失败:', { id, error: errorMsg, code: error?.code })
      const isConnectionError =
        lower.includes("can't reach database server") ||
        lower.includes('can\\u2019t reach database server') ||
        lower.includes('maxclients') ||
        lower.includes('max clients reached') ||
        lower.includes('pool_size') ||
        lower.includes('check out') ||
        lower.includes("can't reach") ||
        lower.includes('connection') ||
        lower.includes('timeout') ||
        lower.includes('pooler') ||
        lower.includes('pool') ||
        lower.includes('P1001') ||
        lower.includes('P1017') ||
        lower.includes('P1000')
      if (isConnectionError) {
        throw new Error('Database connection failed, please try again later')
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
          create: {} 
        }
      }),
      ...(data.userType === 'LANDLORD' && {
        landlordProfile: { 
          create: {} 
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
    
    // 如果有 representedById，单独更新（因为 Prisma Client 可能未包含该字段）
    if (data.representedById) {
      return this.updateUser(user.id, { representedById: data.representedById })
    }
    
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
    
    const hasUserFieldUpdates = Object.keys(updateData).length > 0
    const user = hasUserFieldUpdates
      ? await prisma.user.update({
          where: { id },
          data: updateData,
          include: {
            tenantProfile: true,
            landlordProfile: true,
          },
        })
      : await prisma.user.findUnique({
          where: { id },
          include: {
            tenantProfile: true,
            landlordProfile: true,
          },
        })

    if (!user) {
      throw new Error(`User not found: ${id}`)
    }

    // 处理 representedById 更新
    // 使用 raw SQL 以绕过 Prisma Client 可能存在的字段缺失问题
    if (data.representedById !== undefined) {
      let tableName = user.userType === 'TENANT' ? 'TenantProfile' : 
                        user.userType === 'LANDLORD' ? 'LandlordProfile' : null;
      
      if (tableName) {
        try {
            // Resolve correct table name case
            const tables = await prisma.$queryRawUnsafe(
                `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE $1`,
                tableName
            ) as any[];
            if (tables && tables.length > 0) {
                tableName = tables[0].table_name;
            }

            // 检查记录是否存在
            const checkSql = `SELECT 1 FROM "${tableName}" WHERE "userId" = $1`;
            const exists = await prisma.$queryRawUnsafe(checkSql, id) as any[];
            
            if (exists && exists.length > 0) {
                 await prisma.$executeRawUnsafe(
                    `UPDATE "${tableName}" SET "representedById" = $1, "updatedAt" = NOW() WHERE "userId" = $2`,
                    data.representedById,
                    id
                 );
            } else {
                 const newId = `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
                 // Insert
                 if (tableName === 'TenantProfile') {
                     await prisma.$executeRawUnsafe(
                        `INSERT INTO "${tableName}" ("id", "userId", "representedById", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'SEARCHING', NOW(), NOW())`,
                        newId, id, data.representedById
                     );
                 } else {
                     await prisma.$executeRawUnsafe(
                        `INSERT INTO "${tableName}" ("id", "userId", "representedById", "verified", "createdAt", "updatedAt") VALUES ($1, $2, $3, false, NOW(), NOW())`,
                        newId, id, data.representedById
                     );
                 }
            }
        } catch (error: any) {
            console.error(`Failed to update representedById for ${tableName}:`, error);
            // Auto-migration: 如果列不存在，尝试添加列
            if (error.message && error.message.toLowerCase().includes('does not exist') && error.message.toLowerCase().includes('representedbyid')) {
                console.log(`Adding missing column representedById to ${tableName}...`);
                try {
                    await prisma.$executeRawUnsafe(`ALTER TABLE "${tableName}" ADD COLUMN "representedById" TEXT`);
                    
                    // Retry update/insert
                    const checkSql = `SELECT 1 FROM "${tableName}" WHERE "userId" = $1`;
                    const exists = await prisma.$queryRawUnsafe(checkSql, id) as any[];
                    
                    if (exists && exists.length > 0) {
                         await prisma.$executeRawUnsafe(
                            `UPDATE "${tableName}" SET "representedById" = $1, "updatedAt" = NOW() WHERE "userId" = $2`,
                            data.representedById, id
                         );
                    } else {
                         const newId = `${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
                         if (tableName === 'TenantProfile') {
                             await prisma.$executeRawUnsafe(
                                `INSERT INTO "${tableName}" ("id", "userId", "representedById", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, 'SEARCHING', NOW(), NOW())`,
                                newId, id, data.representedById
                             );
                         } else {
                             await prisma.$executeRawUnsafe(
                                `INSERT INTO "${tableName}" ("id", "userId", "representedById", "verified", "createdAt", "updatedAt") VALUES ($1, $2, $3, false, NOW(), NOW())`,
                                newId, id, data.representedById
                             );
                         }
                    }
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                }
            }
        }
      }
      
      // 重新获取包含最新 profile 的用户信息
      return this.findUserById(id) as Promise<UnifiedUser>
    }
    
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
    
    const tableNameMap: Record<string, string> = {
      users: 'User',
      properties: 'Property',
      applications: 'Application',
      payments: 'Payment',
      deposits: 'Deposit',
      disputes: 'Dispute',
      messages: 'Message',
      savedProperties: 'SavedProperty',
      notifications: 'Notification',
      events: 'Event',
      agentProfiles: 'AgentProfile',
      tenantProfiles: 'TenantProfile',
      landlordProfiles: 'LandlordProfile',
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
    
    // Default includes for users collection to ensure profile data is available
    if (collection === 'users') {
      queryOptions.include = {
        tenantProfile: true,
        landlordProfile: true
        // agentProfile: true // Temporarily disabled as the table might not exist in some environments
      }
    }

    const runRawQuery = async () => {
      const tableName = tableNameMap[collection]
      if (!tableName) {
        throw new Error(`Collection ${collection} not found in Prisma schema`)
      }
      const columnsResult: any[] = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        tableName
      )
      const fallbackColumns = columnsResult.length
        ? columnsResult
        : (await prisma.$queryRawUnsafe(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
            tableName.toLowerCase()
          ) as any[])
      const actualTableName = columnsResult.length ? tableName : tableName.toLowerCase()
      const existingColumns = new Set(
        (fallbackColumns || []).map((col: any) => String(col.column_name))
      )
      const selectableColumns = Array.from(existingColumns)
        .map((col) => `"${actualTableName}"."${col}"`) // Qualify column names
        .join(', ')
      const normalizedFilters = filters ? this.normalizeFilters(filters) : {}
      const conditions: string[] = []
      const values: any[] = []
      let index = 1
      Object.keys(normalizedFilters || {}).forEach((key) => {
        if (key.startsWith('_')) {
          return
        }
        const value = normalizedFilters[key]
        if (
          value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          const handled =
            value.gte !== undefined ||
            value.lte !== undefined ||
            value.gt !== undefined ||
            value.lt !== undefined
          if (value.gte !== undefined) {
            conditions.push(`"${actualTableName}"."${key}" >= $${index}`)
            values.push(value.gte)
            index += 1
          }
          if (value.lte !== undefined) {
            conditions.push(`"${actualTableName}"."${key}" <= $${index}`)
            values.push(value.lte)
            index += 1
          }
          if (value.gt !== undefined) {
            conditions.push(`"${actualTableName}"."${key}" > $${index}`)
            values.push(value.gt)
            index += 1
          }
          if (value.lt !== undefined) {
            conditions.push(`"${actualTableName}"."${key}" < $${index}`)
            values.push(value.lt)
            index += 1
          }
          if (!handled) {
            conditions.push(`"${actualTableName}"."${key}" = $${index}`)
            values.push(value)
            index += 1
          }
        } else if (value !== undefined) {
          conditions.push(`"${actualTableName}"."${key}" = $${index}`)
          values.push(value)
          index += 1
        }
      })
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      let orderClause = ''
      if (queryOptions.orderBy) {
        const [orderKey, orderValue] = Object.entries(queryOptions.orderBy)[0] as [string, any]
        if (existingColumns.has(orderKey)) {
          const direction = String(orderValue).toLowerCase() === 'asc' ? 'ASC' : 'DESC'
          orderClause = `ORDER BY "${actualTableName}"."${orderKey}" ${direction}`
        }
      } else if (existingColumns.has('createdAt')) {
        orderClause = `ORDER BY "${actualTableName}"."createdAt" DESC`
      }
      let limitClause = ''
      if (queryOptions.take !== undefined) {
        limitClause = `LIMIT $${index}`
        values.push(queryOptions.take)
        index += 1
      }
      let offsetClause = ''
      if (queryOptions.skip !== undefined) {
        offsetClause = `OFFSET $${index}`
        values.push(queryOptions.skip)
        index += 1
      }

      // Special handling for 'users' collection to include profile data via LEFT JOIN
      if (collection === 'users') {
        const tenantTableRows = await prisma.$queryRawUnsafe(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE $1`,
          'tenantprofile'
        ) as any[]
        const landlordTableRows = await prisma.$queryRawUnsafe(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE $1`,
          'landlordprofile'
        ) as any[]
        const tenantTableName = tenantTableRows?.[0]?.table_name
        const landlordTableName = landlordTableRows?.[0]?.table_name
        const tenantJoin = tenantTableName ? `LEFT JOIN "${tenantTableName}" tp ON "${actualTableName}"."id" = tp."userId"` : ''
        const landlordJoin = landlordTableName ? `LEFT JOIN "${landlordTableName}" lp ON "${actualTableName}"."id" = lp."userId"` : ''
        const tenantSelect = tenantTableName ? `tp."representedById" as "tenant_representedById"` : `NULL as "tenant_representedById"`
        const landlordSelect = landlordTableName ? `lp."representedById" as "landlord_representedById"` : `NULL as "landlord_representedById"`
        const sql = `
          SELECT ${selectableColumns}, 
                 ${tenantSelect},
                 ${landlordSelect}
          FROM "${actualTableName}"
          ${tenantJoin}
          ${landlordJoin}
          ${whereClause} ${orderClause} ${limitClause} ${offsetClause}
        `
        const results = await prisma.$queryRawUnsafe(sql, ...values) as any[]
        
        return results.map(r => ({
          ...r,
          tenantProfile: { representedById: r.tenant_representedById },
          landlordProfile: { representedById: r.landlord_representedById },
          representedById: r.representedById ?? r.tenant_representedById ?? r.landlord_representedById
        })) as unknown as T[]
      }

      const sql = `SELECT ${selectableColumns} FROM "${actualTableName}" ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`
      return prisma.$queryRawUnsafe(sql, ...values) as Promise<T[]>
    }

    try {
      const results = await model.findMany(queryOptions) as T[]
      if (collection === 'users' && results.length > 0) {
        const hasRepId = results.some((r: any) =>
          r?.representedById !== undefined ||
          r?.tenantProfile?.representedById !== undefined ||
          r?.landlordProfile?.representedById !== undefined
        )
        if (!hasRepId) {
          return await runRawQuery()
        }
      }
      if (collection === 'properties' && results.length > 0) {
        const hasAgentId = results.some((r: any) => r?.agentId !== undefined || r?.agent_id !== undefined)
        if (!hasAgentId) {
          return await runRawQuery()
        }
      }
      return results
    } catch (error: any) {
      console.warn(`[SupabaseAdapter] findMany failed for ${collection}, falling back to raw SQL:`, error.message)
      const errorMsg = String(error?.message || '')
      const lower = errorMsg.toLowerCase()
      const isColumnMissing =
        lower.includes('does not exist') ||
        lower.includes('unknown column') ||
        lower.includes('unknown argument')
      if (!isColumnMissing) {
        throw error
      }
      return await runRawQuery()
    }
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
      representedById: user.tenantProfile?.representedById || user.landlordProfile?.representedById || null,
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
