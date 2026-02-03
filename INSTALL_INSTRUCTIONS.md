# 安装和配置说明

## 1. 安装 Supabase 依赖

由于权限问题，请手动运行：

```bash
npm install @supabase/supabase-js
```

## 2. 配置环境变量

### 步骤 1: 获取 Supabase 数据库密码

1. 访问：https://supabase.com/dashboard
2. 登录并选择项目：`ganektphyohnyweamevs`
3. 进入 **Settings** > **Database**
4. 在 **Connection string** 部分，找到 **Connection pooling** 选项
5. 复制连接字符串，格式如下：
   ```
   postgresql://postgres.ganektphyohnyweamevs:[YOUR_PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

### 步骤 2: 获取 Service Role Key

1. 在 Supabase Dashboard 中，进入 **Settings** > **API**
2. 找到 **service_role** key（**⚠️ 仅在服务器端使用，不要暴露给客户端**）
3. 复制这个 key

### 步骤 3: 更新 .env 文件

创建或编辑项目根目录的 `.env` 文件：

```env
# Database Configuration
# Supabase PostgreSQL 数据库连接
DATABASE_URL="postgresql://postgres:RDdoFMFmSTVCQP4r@db.dhtfuyddjteoqduzvoqw.supabase.co:5432/postgres"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://dhtfuyddjteoqduzvoqw.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRodGZ1eWRkanRlb3FkdXp2b3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzYzMzEsImV4cCI6MjA4NTY1MjMzMX0.RdhnPZPQNcHGi9jkZPQtPTN_SjJkrZ7NDJgMRP0Tlpk"
SUPABASE_SERVICE_ROLE_KEY=""

# CloudBase Configuration (Tencent Cloud)
CLOUDBASE_ENV_ID="homes-8ghqrqte660fbf1d"
CLOUDBASE_REGION="ap-shanghai"
CLOUDBASE_SECRET_ID=""
CLOUDBASE_SECRET_KEY=""

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Mistral AI Configuration
MISTRAL_API_KEY="2eiKa3bWBxk102u1PnDwdskHPI8M2mvh"
MISTRAL_MODEL="mistral-large-latest"

# Node Environment
NODE_ENV="development"
```

## 3. 创建数据库表

配置好环境变量后，运行：

```bash
# 生成 Prisma Client
npm run db:generate

# 推送 schema 到 Supabase（创建所有表）
npm run db:push
```

## 4. 验证连接

```bash
# 打开 Prisma Studio 查看数据库
npm run db:studio
```

如果成功，你应该能看到所有创建的表。

## 5. 填充测试数据（可选）

```bash
npm run db:seed
```

## 故障排除

### 问题：连接失败

**检查**：
1. 确认 `DATABASE_URL` 中的密码正确
2. 确认 Supabase 项目状态正常
3. 检查网络连接
4. 确认使用了正确的连接字符串格式

### 问题：表已存在错误

**解决**：
```bash
# 如果表已存在，使用 migrate 而不是 push
npm run db:migrate
```

### 问题：JSON 字段错误

**说明**：已更新 schema 使用 PostgreSQL 的原生 JSON 类型，不再使用字符串存储 JSON

## 下一步

配置完成后，重启开发服务器：

```bash
npm run dev
```

现在你的应用已经连接到 Supabase 数据库了！🎉
