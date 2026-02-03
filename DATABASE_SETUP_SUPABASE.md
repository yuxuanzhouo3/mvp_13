# Supabase 数据库配置指南

## 1. 获取数据库连接字符串

### 步骤 1: 登录 Supabase Dashboard
访问：https://supabase.com/dashboard

### 步骤 2: 选择项目
选择项目：`ganektphyohnyweamevs`

### 步骤 3: 获取数据库密码
1. 进入 **Settings** > **Database**
2. 找到 **Connection string** 部分
3. 选择 **Connection pooling** (推荐用于生产环境)
4. 复制连接字符串，格式如下：
   ```
   postgresql://postgres.ganektphyohnyweamevs:[YOUR_PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

### 步骤 4: 获取 Service Role Key
1. 在 **Settings** > **API** 中
2. 找到 **service_role** key（**注意：仅在服务器端使用，不要暴露给客户端**）

## 2. 配置环境变量

在 `.env` 文件中更新以下内容：

```env
# 替换 [YOUR_PASSWORD] 为你的数据库密码
DATABASE_URL="postgresql://postgres:RDdoFMFmSTVCQP4r@db.dhtfuyddjteoqduzvoqw.supabase.co:5432/postgres"

# Service Role Key (从 Supabase Dashboard 获取)
SUPABASE_SERVICE_ROLE_KEY=""
```

## 3. 创建数据库表

### 方法 1: 使用 Prisma Migrate (推荐)

```bash
# 生成迁移文件
npm run db:migrate

# 或者直接推送 schema（开发环境）
npm run db:push
```

### 方法 2: 使用 Supabase SQL Editor

1. 进入 Supabase Dashboard > **SQL Editor**
2. 运行以下 SQL 创建表（或使用 Prisma 生成的迁移文件）

## 4. 验证连接

```bash
# 生成 Prisma Client
npm run db:generate

# 测试连接
npm run db:studio
```

## 5. 注意事项

- **Connection Pooling**: 使用 `pooler.supabase.com:6543` 端口用于连接池
- **直接连接**: 如果需要直接连接，使用端口 `5432`
- **SSL**: Supabase 要求 SSL 连接，Prisma 会自动处理
- **环境变量**: 确保 `.env` 文件不被提交到 Git

## 6. 数据库迁移

当 schema 更新时：

```bash
# 创建新的迁移
npm run db:migrate

# 应用迁移到生产环境
npx prisma migrate deploy
```

## 7. 监控和维护

- 在 Supabase Dashboard 中监控数据库性能
- 定期备份数据库
- 使用 Supabase Studio 查看和管理数据
