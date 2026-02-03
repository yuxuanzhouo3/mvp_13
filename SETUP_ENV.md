# 环境变量配置指南

## 快速配置步骤

### 1. 数据库配置

#### 选项A: 使用本地PostgreSQL

如果你已经安装了PostgreSQL：

```bash
# 创建数据库
createdb rentguard

# 或者使用psql
psql -U postgres
CREATE DATABASE rentguard;
```

然后在 `.env` 文件中配置：
```env
DATABASE_URL="postgresql://postgres:你的密码@localhost:5432/rentguard?schema=public"
```

#### 选项B: 使用云数据库（推荐生产环境）

**Supabase (免费)**
1. 访问 https://supabase.com
2. 创建新项目
3. 在项目设置中找到数据库连接字符串
4. 复制到 `.env` 文件

**其他选项:**
- Neon (https://neon.tech) - 免费PostgreSQL
- Railway (https://railway.app) - 简单部署
- Vercel Postgres - 如果部署在Vercel

### 2. JWT密钥配置

生成一个安全的随机字符串：

```bash
# 在Node.js中生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

或者使用在线工具生成随机字符串，然后填入 `.env`：
```env
JWT_SECRET="生成的随机字符串"
```

### 3. OpenAI API配置（可选）

如果你想要使用AI功能进行更准确的自然语言解析：

1. 访问 https://platform.openai.com/api-keys
2. 创建新的API密钥
3. 复制到 `.env` 文件：
```env
OPENAI_API_KEY="sk-你的API密钥"
```

**注意**: 如果不配置OpenAI API Key，系统仍然可以工作，只是使用基于规则的解析，准确度可能稍低。

### 4. 验证配置

运行以下命令验证配置：

```bash
# 检查环境变量是否加载
node -e "require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已配置' : '未配置'); console.log('JWT_SECRET:', process.env.JWT_SECRET ? '已配置' : '未配置');"
```

## 环境变量说明

| 变量名 | 必需 | 说明 |
|--------|------|------|
| `DATABASE_URL` | ✅ 是 | PostgreSQL数据库连接字符串 |
| `JWT_SECRET` | ✅ 是 | JWT Token加密密钥 |
| `OPENAI_API_KEY` | ❌ 否 | OpenAI API密钥（可选，用于AI功能） |
| `OPENAI_MODEL` | ❌ 否 | OpenAI模型名称（默认: gpt-3.5-turbo） |
| `NODE_ENV` | ❌ 否 | 运行环境（development/production） |
| `NEXT_PUBLIC_APP_URL` | ❌ 否 | 应用URL（用于CORS等） |

## 常见问题

### Q: 我没有PostgreSQL数据库怎么办？

A: 可以使用免费的云数据库服务：
- **Supabase**: https://supabase.com (推荐，免费额度大)
- **Neon**: https://neon.tech (免费PostgreSQL)
- **Railway**: https://railway.app (简单易用)

### Q: 如何测试数据库连接？

A: 运行以下命令：
```bash
pnpm db:push
```

如果连接成功，会看到数据库schema被创建。

### Q: JWT_SECRET可以随便填吗？

A: 开发环境可以，但生产环境必须使用强随机字符串。建议至少32个字符。

### Q: 不配置OpenAI API会影响功能吗？

A: 不会。系统有基于规则的备用解析方案，只是准确度可能稍低。AI功能是可选的。

## 下一步

配置完成后，运行：

```bash
# 生成Prisma客户端
pnpm db:generate

# 推送数据库schema
pnpm db:push

# 启动开发服务器
pnpm dev
```
