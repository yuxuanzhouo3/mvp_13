# Events 表/集合设置指南

## 概述

Events 表用于存储数据埋点信息，支持后台统计分析。由于 Prisma schema 中未包含 Events 模型，需要手动创建。

## 国际版（Supabase PostgreSQL）

### 方法 1：在 Prisma Schema 中添加 Events 模型（推荐）

在 `prisma/schema.prisma` 文件中添加以下模型：

```prisma
// 事件记录（用于数据埋点）
model Event {
  id        String   @id @default(cuid())
  type      String   // USER_SIGNUP, PAYMENT, AI_SEARCH, etc.
  userId    String?
  region    String   // 'global' | 'china'
  timestamp DateTime @default(now())
  metadata  Json?    // 额外数据 (JSON)

  @@index([type])
  @@index([userId])
  @@index([timestamp])
  @@index([region])
}
```

然后运行：

```bash
npx prisma db push
# 或
npx prisma migrate dev --name add_events_table
```

### 方法 2：直接在 Supabase 中创建表

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "userId" TEXT,
  "region" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB
);

CREATE INDEX IF NOT EXISTS "Event_type_idx" ON "Event"("type");
CREATE INDEX IF NOT EXISTS "Event_userId_idx" ON "Event"("userId");
CREATE INDEX IF NOT EXISTS "Event_timestamp_idx" ON "Event"("timestamp");
CREATE INDEX IF NOT EXISTS "Event_region_idx" ON "Event"("region");
```

## 国内版（CloudBase）

CloudBase 是文档型数据库，不需要预先定义 schema。Events 集合会在第一次写入时自动创建。

### 建议的索引

在 CloudBase 控制台中为 `events` 集合创建以下索引：

1. **type** - 单字段索引
2. **userId** - 单字段索引
3. **timestamp** - 单字段索引（降序）
4. **region** - 单字段索引

### 索引创建方法

在 CloudBase 控制台：
1. 进入数据库管理
2. 选择 `events` 集合
3. 点击"索引管理"
4. 添加上述索引

## 数据库适配器更新

更新 `lib/db-adapter.ts` 中的 `SupabaseAdapter` 类，添加 Events 支持：

```typescript
async query<T = any>(collection: string, filters?: any, options?: any): Promise<T[]> {
  const modelMap: Record<string, any> = {
    'users': prisma.user,
    'properties': prisma.property,
    'applications': prisma.application,
    'payments': prisma.payment,
    'events': prisma.event, // 添加 Events 支持
  }
  
  // ... 其余代码
}
```

同样更新 `create`, `update`, `delete`, `count` 方法。

## 验证

创建 Events 表/集合后，可以通过以下方式验证：

```typescript
import { trackEvent } from '@/lib/analytics'

// 测试埋点
await trackEvent({
  type: 'USER_SIGNUP',
  userId: 'test-user-id',
  metadata: { test: true }
})
```

然后在数据库中检查是否有新记录。
