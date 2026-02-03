# 环境变量配置指南

## 快速配置步骤

### 方法1: 手动创建 .env 文件

在项目根目录（与 `package.json` 同级）创建 `.env` 文件，复制以下内容：

```env
# ============================================
# RentGuard 环境变量配置
# ============================================

# 数据库配置
# 请替换为你的PostgreSQL数据库连接字符串
# 格式: postgresql://用户名:密码@主机:端口/数据库名?schema=public
DATABASE_URL=postgresql://postgres:password@localhost:5432/rentguard?schema=public

# JWT密钥
# 用于生成和验证JWT Token，请使用强密码
# 生产环境请务必更改此值！
JWT_SECRET=rentguard-super-secret-jwt-key-change-in-production-2024

# OpenAI API配置（可选）
# 如果配置了OpenAI API Key，系统会使用AI进行更准确的自然语言解析
# 如果不配置，系统会使用基于规则的解析（功能仍然可用）
OPENAI_API_KEY=
OPENAI_MODEL=gpt-3.5-turbo

# 应用配置
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 方法2: 使用命令行创建（Windows PowerShell）

在项目根目录执行：

```powershell
@"
# RentGuard Environment Variables

DATABASE_URL=postgresql://postgres:password@localhost:5432/rentguard?schema=public

JWT_SECRET=rentguard-super-secret-jwt-key-change-in-production-2024

OPENAI_API_KEY=
OPENAI_MODEL=gpt-3.5-turbo

NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
"@ | Out-File -FilePath .env -Encoding utf8
```

### 方法3: 使用命令行创建（Git Bash / Linux / Mac）

```bash
cat > .env << 'EOF'
# RentGuard Environment Variables

DATABASE_URL=postgresql://postgres:password@localhost:5432/rentguard?schema=public

JWT_SECRET=rentguard-super-secret-jwt-key-change-in-production-2024

OPENAI_API_KEY=
OPENAI_MODEL=gpt-3.5-turbo

NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

## 配置说明

### 1. DATABASE_URL（必需）

**本地PostgreSQL:**
```env
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/rentguard?schema=public
```

**Supabase（免费）:**
1. 访问 https://supabase.com
2. 创建新项目
3. 在 Settings > Database 找到连接字符串
4. 复制到 `.env` 文件

**其他云数据库:**
- Neon: https://neon.tech
- Railway: https://railway.app
- Vercel Postgres: 如果部署在Vercel

### 2. JWT_SECRET（必需）

用于加密JWT Token。可以使用以下命令生成随机字符串：

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### 3. OPENAI_API_KEY（可选）

如果你想要使用AI功能进行更准确的自然语言解析：

1. 访问 https://platform.openai.com/api-keys
2. 创建新的API密钥
3. 复制到 `.env` 文件：
```env
OPENAI_API_KEY=sk-你的API密钥
```

**注意**: 如果不配置，系统仍然可以工作，只是使用基于规则的解析。

## 验证配置

创建 `.env` 文件后，运行以下命令验证：

```bash
# 生成Prisma客户端
pnpm db:generate

# 推送数据库schema（首次设置）
pnpm db:push
```

如果配置正确，会看到数据库表被创建。

## 常见问题

### Q: 我没有PostgreSQL数据库怎么办？

A: 可以使用免费的云数据库：
- **Supabase** (推荐): https://supabase.com - 免费额度大，易于使用
- **Neon**: https://neon.tech - 免费PostgreSQL
- **Railway**: https://railway.app - 简单易用

### Q: 如何测试数据库连接？

A: 运行 `pnpm db:push`，如果连接成功，会看到数据库schema被创建。

### Q: JWT_SECRET可以随便填吗？

A: 开发环境可以，但生产环境必须使用强随机字符串（至少32个字符）。

### Q: 不配置OpenAI API会影响功能吗？

A: 不会。系统有基于规则的备用解析方案，只是准确度可能稍低。

## 下一步

配置完成后：

```bash
# 1. 生成Prisma客户端
pnpm db:generate

# 2. 推送数据库schema
pnpm db:push

# 3. （可选）填充测试数据
pnpm db:seed

# 4. 启动开发服务器
pnpm dev
```
