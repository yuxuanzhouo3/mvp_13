# 双版本架构迁移指南

本文档说明如何将现有 API 迁移到支持双版本（国际版/国内版）的架构。

## 核心原则

1. **统一接口**：所有 API 使用统一的适配器接口，不直接调用 Prisma 或 CloudBase
2. **环境变量控制**：通过 `NEXT_PUBLIC_APP_REGION` 自动选择数据库
3. **数据格式一致**：无论使用哪种数据库，返回给前端的数据格式必须一致

## 迁移步骤

### 1. 替换导入

**旧代码：**
```typescript
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
```

**新代码：**
```typescript
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { getCurrentUser } from '@/lib/auth-adapter'
```

### 2. 替换认证

**旧代码：**
```typescript
const user = getAuthUser(request)
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
// 使用 user.userId
```

**新代码：**
```typescript
const user = await getCurrentUser(request)
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
// 使用 user.id（注意：字段名从 userId 改为 id）
```

### 3. 替换数据库操作

#### 查找用户

**旧代码：**
```typescript
const dbUser = await prisma.user.findUnique({
  where: { id: user.userId }
})
```

**新代码：**
```typescript
const db = getDatabaseAdapter()
const dbUser = await db.findUserById(user.id)
```

#### 创建记录

**旧代码：**
```typescript
const property = await prisma.property.create({
  data: {
    landlordId: user.userId,
    title: '...',
    // ...
  }
})
```

**新代码：**
```typescript
const db = getDatabaseAdapter()
const property = await db.create('properties', {
  landlordId: user.id,
  title: '...',
  // ...
})
```

#### 查询记录

**旧代码：**
```typescript
const properties = await prisma.property.findMany({
  where: { landlordId: user.userId },
  include: { landlord: true }
})
```

**新代码：**
```typescript
const db = getDatabaseAdapter()
const properties = await db.query('properties', {
  landlordId: user.id
})

// 如果需要关联数据，需要手动查询
const propertiesWithLandlord = await Promise.all(
  properties.map(async (property) => {
    const landlord = await db.findUserById(property.landlordId)
    return { ...property, landlord }
  })
)
```

#### 更新记录

**旧代码：**
```typescript
const user = await prisma.user.update({
  where: { id: userId },
  data: { isPremium: true }
})
```

**新代码：**
```typescript
const db = getDatabaseAdapter()
const user = await db.updateUser(userId, {
  isPremium: true
})
```

### 4. 添加配额检查（如适用）

对于需要消耗配额的操作（如 AI 搜索），添加配额检查：

```typescript
import { deductQuota } from '@/lib/subscription-service'

// 在执行业务逻辑前
const quotaResult = await deductQuota(user.id, 1)
if (!quotaResult.success) {
  return NextResponse.json(
    { error: quotaResult.message || '配额不足' },
    { status: 403 }
  )
}
```

### 5. 添加埋点（如适用）

对于关键操作，添加埋点：

```typescript
import { trackEvent, trackPayment } from '@/lib/analytics'

// 支付完成后
await trackPayment(userId, amount, currency, paymentMethod, transactionId)

// 订阅升级
await trackEvent({
  type: 'SUBSCRIPTION_UPGRADE',
  userId,
  metadata: { fromTier, toTier, amount }
})
```

## 注意事项

### 1. 字段名差异

- Prisma 返回的字段名是 `id`，CloudBase 返回的是 `_id` 或 `id`
- 适配器已统一处理，业务代码统一使用 `id`

### 2. 关联查询

- Prisma 支持 `include` 关联查询
- CloudBase 不支持关联查询，需要手动查询并合并
- 适配器的 `query` 方法返回的是基础数据，关联数据需要手动处理

### 3. 复杂查询

- Prisma 支持复杂的 SQL 查询（where、orderBy、skip、take 等）
- CloudBase 的查询能力有限，复杂查询需要：
  - 在应用层实现过滤和排序
  - 或者使用 CloudBase 的聚合查询（如果支持）

### 4. 事务处理

- Prisma 支持事务
- CloudBase 可能不支持事务，需要根据实际情况处理

### 5. 数据类型

- Prisma 使用强类型（基于 schema.prisma）
- CloudBase 是文档型数据库，类型较灵活
- 确保数据格式一致，特别是日期、JSON 等类型

## 示例：完整的 API 迁移

### 迁移前

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const applications = await prisma.application.findMany({
    where: { tenantId: user.userId },
    include: {
      property: true,
      tenant: true
    }
  })

  return NextResponse.json({ applications })
}
```

### 迁移后

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDatabaseAdapter()
  const applications = await db.query('applications', {
    tenantId: user.id
  })

  // 手动加载关联数据
  const applicationsWithRelations = await Promise.all(
    applications.map(async (app) => {
      const [property, tenant] = await Promise.all([
        db.findById('properties', app.propertyId),
        db.findUserById(app.tenantId)
      ])
      return {
        ...app,
        property,
        tenant
      }
    })
  )

  return NextResponse.json({ applications: applicationsWithRelations })
}
```

## 测试建议

1. **单元测试**：测试适配器层的各个方法
2. **集成测试**：测试完整的 API 流程
3. **双环境测试**：分别在 `global` 和 `china` 环境下测试
4. **数据一致性测试**：确保两种数据库返回的数据格式一致

## 常见问题

### Q: 如何处理 Prisma 特有的功能（如事务）？

A: 在适配器层实现降级方案，或者使用条件判断：

```typescript
const region = getAppRegion()
if (region === 'global') {
  // 使用 Prisma 事务
  await prisma.$transaction([...])
} else {
  // CloudBase 的替代方案
  // ...
}
```

### Q: 如何处理复杂的 SQL 查询？

A: 在适配器层实现查询构建器，或者分别实现：

```typescript
async function complexQuery(filters: any) {
  const region = getAppRegion()
  if (region === 'global') {
    return await prisma.property.findMany({
      where: filters,
      // 复杂查询...
    })
  } else {
    // CloudBase 的查询实现
    return await cloudbaseDb.collection('properties')
      .where(filters)
      .get()
  }
}
```
