# 双版本架构实现总结

## 概述

本项目已实现支持国际版和国内版的双版本架构，通过环境变量 `NEXT_PUBLIC_APP_REGION` 自动切换数据库和认证方式。

## 核心架构

### 1. 数据库适配器层 (`lib/db-adapter.ts`)

**功能**：
- 统一数据库接口，自动根据环境变量选择 Supabase 或 CloudBase
- 提供统一的 CRUD 操作方法
- 统一数据格式，确保前端代码无需修改

**关键方法**：
- `getDatabaseAdapter()`: 获取当前环境的数据库适配器
- `findUserByEmail()`, `findUserById()`: 用户查询
- `createUser()`, `updateUser()`: 用户操作
- `query()`, `create()`, `update()`, `delete()`, `count()`: 通用数据库操作

### 2. 身份验证适配器 (`lib/auth-adapter.ts`)

**功能**：
- 统一认证接口，支持 Supabase Auth 和自建 JWT
- 国际版：使用 Supabase Auth（支持 OAuth）
- 国内版：使用自建 JWT 认证

**关键方法**：
- `getCurrentUser()`: 获取当前认证用户（统一接口）
- `signUp()`, `login()`: 统一的注册/登录接口
- `loginWithOAuth()`: OAuth 登录（仅国际版）

### 3. 订阅与配额管理 (`lib/subscription-service.ts`)

**功能**：
- 懒加载刷新机制：用户请求时自动检查并刷新配额
- 订阅状态检查：自动检测过期并降级
- 配额扣除与验证

**订阅级别**：
- FREE: 每日 10 次，每月 100 次
- BASIC: 每日 50 次，每月 500 次
- PREMIUM: 每日 200 次，每月 2000 次
- ENTERPRISE: 无限

**关键方法**：
- `checkAndRefreshQuota()`: 检查并刷新配额
- `deductQuota()`: 扣除配额
- `upgradeSubscription()`, `downgradeSubscription()`: 订阅管理

### 4. 数据埋点系统 (`lib/analytics.ts`)

**功能**：
- 记录关键事件（注册、支付、搜索等）
- 自动存储到对应的数据库（Supabase Events 表 或 CloudBase Events 集合）
- 统一的数据格式

**事件类型**：
- `USER_SIGNUP`, `USER_LOGIN`
- `PAYMENT`, `SUBSCRIPTION_UPGRADE`, `SUBSCRIPTION_DOWNGRADE`
- `AI_SEARCH`, `PROPERTY_VIEW`, `APPLICATION_SUBMIT`
- `DEVICE_ACCESS`

### 5. 后台统计 API (`app/api/admin/stats/route.ts`)

**功能**：
- 聚合国内外数据统计
- 支持按区域（global/china/all）和周期（day/month/all）查询
- 统计指标：
  - 用户：日活跃/月活跃/总用户
  - 收入：日收入/月收入/总收入
  - 订阅：日订阅/月订阅/总订阅及类型分布
  - 设备：各平台使用统计

## 已修改的 API

### 认证相关
- ✅ `app/api/auth/login/route.ts` - 使用统一登录接口
- ✅ `app/api/auth/signup/route.ts` - 使用统一注册接口，添加埋点
- ✅ `app/api/auth/callback/route.ts` - OAuth 回调（新增）

### 业务相关
- ✅ `app/api/ai/chat/route.ts` - 添加配额检查和埋点
- ✅ `app/api/properties/route.ts` - 使用数据库适配器（示例）

### 管理相关
- ✅ `app/api/admin/stats/route.ts` - 后台统计 API（新增）

## 部署配置

### 国际版（Vercel）
- 环境变量：`NEXT_PUBLIC_APP_REGION=global`
- 数据库：Supabase PostgreSQL
- 认证：Supabase Auth
- 支付：Stripe/PayPal

### 国内版（CloudBase）
- 环境变量：`NEXT_PUBLIC_APP_REGION=china`
- 数据库：CloudBase NoSQL
- 认证：自建 JWT
- 支付：支付宝/微信（待实现）
- Dockerfile：已创建，支持多阶段构建

## 文件清单

### 核心文件
- `lib/db-adapter.ts` - 数据库适配器层
- `lib/auth-adapter.ts` - 身份验证适配器
- `lib/subscription-service.ts` - 订阅与配额管理
- `lib/analytics.ts` - 数据埋点系统

### 配置文件
- `Dockerfile` - 国内版 Docker 部署配置
- `.dockerignore` - Docker 构建忽略文件
- `next.config.mjs` - Next.js 配置（已启用 standalone 模式）

### 文档
- `MIGRATION_GUIDE.md` - API 迁移指南
- `EVENTS_TABLE_SETUP.md` - Events 表/集合设置指南
- `DEPLOYMENT_GUIDE.md` - 部署指南
- `ARCHITECTURE_SUMMARY.md` - 本文档

## 使用示例

### 在 API 中使用数据库适配器

```typescript
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { getCurrentUser } from '@/lib/auth-adapter'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDatabaseAdapter()
  const data = await db.query('properties', { landlordId: user.id })
  
  return NextResponse.json({ data })
}
```

### 使用配额检查

```typescript
import { deductQuota } from '@/lib/subscription-service'

const quotaResult = await deductQuota(user.id, 1)
if (!quotaResult.success) {
  return NextResponse.json(
    { error: quotaResult.message },
    { status: 403 }
  )
}
```

### 使用埋点

```typescript
import { trackEvent, trackPayment } from '@/lib/analytics'

await trackEvent({
  type: 'USER_SIGNUP',
  userId: user.id,
  metadata: { userType: 'TENANT' }
})

await trackPayment(userId, amount, 'USD', 'stripe', transactionId)
```

## 待完成的工作

### 1. 数据库 Schema 更新
- [ ] 在 Prisma schema 中添加 Event 模型（见 `EVENTS_TABLE_SETUP.md`）
- [ ] 运行数据库迁移

### 2. API 迁移
- [ ] 迁移剩余的 API 路由（参考 `MIGRATION_GUIDE.md`）
- [ ] 测试所有 API 在两种环境下的表现

### 3. 支付集成
- [ ] 国际版：集成 Stripe/PayPal（已有配置）
- [ ] 国内版：集成支付宝/微信支付

### 4. OAuth 配置
- [ ] 在 Supabase 中配置 Google OAuth
- [ ] 配置 OAuth 回调 URL

### 5. 后台管理
- [ ] 创建后台管理前端页面
- [ ] 实现数据可视化
- [ ] 实现广告管理功能

### 6. 测试
- [ ] 单元测试：适配器层
- [ ] 集成测试：完整 API 流程
- [ ] 双环境测试：global 和 china

## 注意事项

1. **环境变量**：确保在部署时正确设置 `NEXT_PUBLIC_APP_REGION`
2. **数据库初始化**：
   - 国际版：运行 Prisma 迁移
   - 国内版：在 CloudBase 控制台创建集合
3. **Events 表**：需要手动创建（见 `EVENTS_TABLE_SETUP.md`）
4. **数据一致性**：确保两种数据库返回的数据格式一致
5. **性能优化**：CloudBase 的查询能力有限，复杂查询需要在应用层实现

## 技术支持

如有问题，请参考：
- `MIGRATION_GUIDE.md` - API 迁移指南
- `DEPLOYMENT_GUIDE.md` - 部署指南
- `EVENTS_TABLE_SETUP.md` - Events 表设置
