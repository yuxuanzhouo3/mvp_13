# Supabase 登录问题诊断指南

## 问题：国际版登录显示 "Invalid email or password"

### 可能的原因

1. **Supabase 环境变量未配置**
   - 系统会降级到 JWT 登录
   - 如果用户在 Supabase Auth 中但不在数据库中，会登录失败

2. **用户在 Supabase Auth 中，但密码不匹配**
   - 密码可能被更改或重置
   - 需要使用正确的密码

3. **用户只在数据库中，不在 Supabase Auth 中**
   - 用户可能是通过 JWT 注册的
   - 系统会自动降级到 JWT 登录

4. **数据库连接问题**
   - Supabase PostgreSQL 连接失败
   - 系统会尝试降级，但可能仍然失败

## 诊断步骤

### 1. 检查环境变量配置

确保在 `.env.local` 或 `.env` 文件中配置了以下变量：

```env
# 区域设置（国际版）
NEXT_PUBLIC_APP_REGION=global

# Supabase 配置（必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 推荐配置

# 数据库配置（用于 JWT 降级）
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=your-jwt-secret
```

### 2. 获取 Supabase 配置值

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **Settings** → **API**
4. 复制以下值：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`（在 "Project API keys" 部分）

### 3. 检查用户是否存在

#### 在 Supabase Dashboard 中检查：

1. 进入 **Authentication** → **Users**
2. 搜索你的邮箱
3. 检查用户是否存在

#### 在数据库中检查：

1. 进入 **Database** → **Table Editor**
2. 打开 `User` 表
3. 搜索你的邮箱

### 4. 查看服务器日志

启动开发服务器后，查看控制台输出：

```bash
npm run dev
```

查找以下日志：
- `[Login] 国际版模式，尝试 Supabase 登录`
- `[loginWithSupabase] Supabase Admin 客户端未初始化` - 说明环境变量未配置
- `[Login] Supabase 登录失败，降级到 JWT` - 说明 Supabase 登录失败，正在降级
- `[Login] ✅ JWT 登录成功（降级）` - 说明降级成功

## 解决方案

### 方案 1: 配置 Supabase 环境变量

如果 Supabase 环境变量未配置：

1. 在项目根目录创建或编辑 `.env.local` 文件
2. 添加 Supabase 配置（见上面的配置示例）
3. 重启开发服务器

### 方案 2: 重置用户密码

如果用户在 Supabase Auth 中但密码不匹配：

1. 在 Supabase Dashboard 中：
   - 进入 **Authentication** → **Users**
   - 找到用户
   - 点击 **Reset Password** 或手动设置密码

2. 或者使用 Supabase CLI：
   ```bash
   supabase auth reset-password --email user@example.com
   ```

### 方案 3: 重新创建用户

如果用户数据不一致：

1. **选项 A**: 在 Supabase Dashboard 中创建用户
   - 进入 **Authentication** → **Users** → **Add User**
   - 输入邮箱和密码
   - 系统会自动在数据库中创建用户记录

2. **选项 B**: 通过注册接口重新注册
   - 访问 `/auth/signup`
   - 使用相同的邮箱注册
   - 系统会自动处理 Supabase 和数据库的同步

### 方案 4: 使用 JWT 登录（降级方案）

如果 Supabase 配置有问题，系统会自动降级到 JWT 登录：

1. 确保 `DATABASE_URL` 和 `JWT_SECRET` 已配置
2. 确保用户在数据库中存在（`User` 表）
3. 使用数据库中存储的密码登录

**注意**: JWT 登录需要用户在数据库中有密码哈希。如果用户是通过 Supabase Auth 创建的，可能没有密码哈希。

## 常见错误消息

### "Invalid email or password"
- **原因**: 密码错误或用户不存在
- **解决**: 检查密码，或重置密码

### "Database connection failed, please try again later"
- **原因**: 数据库连接问题
- **解决**: 检查 `DATABASE_URL` 配置，确保 Supabase 项目正常运行

### "Supabase not initialized"
- **原因**: Supabase 环境变量未配置
- **解决**: 配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 测试登录流程

1. **检查环境变量**:
   ```bash
   # 在项目根目录运行
   node -e "require('dotenv').config(); console.log('Region:', process.env.NEXT_PUBLIC_APP_REGION); console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '已配置' : '未配置');"
   ```

2. **查看服务器日志**:
   - 启动服务器: `npm run dev`
   - 尝试登录
   - 查看控制台输出的详细日志

3. **检查 Supabase Dashboard**:
   - 确认项目状态正常
   - 检查用户是否存在
   - 查看 API 日志（Settings → Logs）

## 需要帮助？

如果问题仍然存在，请提供以下信息：

1. 服务器日志（包含 `[Login]` 和 `[loginWithSupabase]` 标记的日志）
2. 环境变量配置状态（隐藏敏感信息）
3. Supabase Dashboard 中的用户状态
4. 数据库中的用户记录
