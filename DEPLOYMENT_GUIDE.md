# 部署指南

## 国际版部署（Vercel）

### 1. 准备工作

1. 在 GitHub 上创建仓库并推送代码
2. 在 Vercel 官网注册账号并连接 GitHub

### 2. 在 Vercel 中部署

1. 登录 Vercel Dashboard
2. 点击 "New Project"
3. 选择你的 GitHub 仓库
4. 配置项目：
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (默认)
   - **Build Command**: `npm run build` 或 `pnpm build`
   - **Output Directory**: `.next` (Next.js 自动处理)

### 3. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

```env
# 应用区域（必须）
NEXT_PUBLIC_APP_REGION=global

# Supabase 配置
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# JWT Secret
JWT_SECRET=your-secret-key

# Mistral AI
MISTRAL_API_KEY=your-api-key
MISTRAL_MODEL=mistral-large-latest

# Stripe（国际支付）
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Node 环境
NODE_ENV=production
```

### 4. 部署

1. 点击 "Deploy"
2. 等待构建完成
3. 访问生成的 URL（例如：`https://your-project.vercel.app`）

### 5. 数据库迁移

如果使用 Prisma，需要在部署后运行迁移：

```bash
# 在 Vercel 的部署日志中，或者通过 Vercel CLI
npx prisma migrate deploy
```

或者使用 Vercel 的 Build Command：

```bash
npx prisma generate && npx prisma migrate deploy && npm run build
```

## 国内版部署（腾讯云 CloudBase）

### 1. 准备工作

1. 在腾讯云控制台开通 CloudBase 云托管服务
2. 创建环境并获取环境 ID
3. 获取 SecretId 和 SecretKey（API 密钥）

### 2. 准备 Dockerfile

项目根目录已包含 `Dockerfile`，确保配置正确。

### 3. 在 CloudBase 控制台配置

1. 登录 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 进入"云托管" -> "服务管理"
3. 点击"新建服务"
4. 配置服务：
   - **服务名称**: rentguard-china
   - **运行环境**: Docker
   - **代码来源**: GitHub（连接你的仓库）

### 4. 配置环境变量

在 CloudBase 服务配置中添加环境变量：

```env
# 应用区域（必须）
NEXT_PUBLIC_APP_REGION=china

# CloudBase 配置
CLOUDBASE_ENV_ID=homes-8ghqrqte660fbf1d
CLOUDBASE_REGION=ap-shanghai
CLOUDBASE_SECRET_ID=AKID...
CLOUDBASE_SECRET_KEY=xxx...

# JWT Secret
JWT_SECRET=your-secret-key

# Mistral AI
MISTRAL_API_KEY=your-api-key
MISTRAL_MODEL=mistral-large-latest

# Node 环境
NODE_ENV=production
```

### 5. 配置构建和部署

1. **构建配置**:
   - **Dockerfile 路径**: `./Dockerfile`
   - **构建目录**: `./`

2. **部署配置**:
   - **容器端口**: `3000`
   - **CPU**: 1 核（可根据需要调整）
   - **内存**: 1GB（可根据需要调整）
   - **实例数量**: 1（可根据需要调整）

### 6. 部署

1. 点击"开始部署"
2. 等待构建和部署完成
3. 访问生成的 URL（例如：`https://your-service.tcb.com`）

### 7. 数据库初始化

CloudBase 是文档型数据库，不需要迁移。但需要确保：

1. 在 CloudBase 控制台创建必要的集合：
   - `users`
   - `properties`
   - `applications`
   - `payments`
   - `events`
   - 等等...

2. 为集合创建索引（见 `EVENTS_TABLE_SETUP.md`）

## 环境变量对比

### 国际版（Vercel）

```env
NEXT_PUBLIC_APP_REGION=global
# Supabase 配置
DATABASE_URL=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# Stripe 配置
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
STRIPE_SECRET_KEY=...
```

### 国内版（CloudBase）

```env
NEXT_PUBLIC_APP_REGION=china
# CloudBase 配置
CLOUDBASE_ENV_ID=...
CLOUDBASE_REGION=...
CLOUDBASE_SECRET_ID=...
CLOUDBASE_SECRET_KEY=...
# 国内支付配置（支付宝/微信）
# ALIPAY_APP_ID=...
# WECHAT_PAY_APP_ID=...
```

## 注意事项

1. **环境变量安全**：
   - 不要在代码中硬编码密钥
   - 使用环境变量管理敏感信息
   - 定期轮换密钥

2. **数据库连接**：
   - 国际版使用 Supabase 连接池，注意连接数限制
   - 国内版使用 CloudBase SDK，注意 API 调用频率限制

3. **构建优化**：
   - 使用 `.dockerignore` 排除不必要的文件
   - 优化 Docker 镜像大小
   - 使用多阶段构建（已在 Dockerfile 中实现）

4. **监控和日志**：
   - Vercel: 使用 Vercel Analytics 和 Logs
   - CloudBase: 使用 CloudBase 控制台的日志功能

5. **域名配置**：
   - Vercel: 可以绑定自定义域名
   - CloudBase: 可以绑定自定义域名（需要备案）

## 故障排查

### 国际版（Vercel）

1. **构建失败**：
   - 检查环境变量是否正确
   - 检查 `package.json` 中的依赖
   - 查看构建日志

2. **数据库连接失败**：
   - 检查 `DATABASE_URL` 是否正确
   - 检查 Supabase 项目是否正常运行
   - 检查网络连接

### 国内版（CloudBase）

1. **Docker 构建失败**：
   - 检查 Dockerfile 语法
   - 检查依赖安装是否成功
   - 查看构建日志

2. **服务启动失败**：
   - 检查环境变量是否正确
   - 检查端口配置（应该是 3000）
   - 查看容器日志

3. **数据库连接失败**：
   - 检查 CloudBase 环境 ID 是否正确
   - 检查 SecretId 和 SecretKey 是否正确
   - 检查网络连接
