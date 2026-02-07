# 数据库连接问题修复指南

## 问题：显示 "Database connection failed, please try again later"

### 快速诊断

1. **检查环境变量**
   ```bash
   # 确保 .env 或 .env.local 文件中有 DATABASE_URL
   DATABASE_URL=postgresql://postgres:password@host:port/database
   ```

2. **检查 Supabase 连接配置**

   Supabase 提供两种连接方式：

   #### 方式 1: 直接连接（端口 5432）
   ```
   postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
   ```
   - 用于：数据库迁移、一次性操作
   - 限制：最多 4 个并发连接

   #### 方式 2: 连接池（端口 6543）- **推荐用于应用**
   ```
   postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
   ```
   - 用于：应用连接、API 请求
   - 优势：支持更多并发连接（最多 200 个）

### 解决方案

#### 方案 1: 使用 Supabase 连接池（推荐）

1. **获取连接池 URL**：
   - 访问 Supabase Dashboard: https://app.supabase.com
   - 进入你的项目 → Settings → Database
   - 找到 "Connection string" 部分
   - 选择 "Connection pooling" 标签
   - 复制连接字符串（端口应该是 6543）

2. **更新 .env 文件**：
   ```env
   DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
   ```

3. **重启开发服务器**

#### 方案 2: 检查连接字符串格式

确保连接字符串格式正确：

```env
# ✅ 正确格式
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# ❌ 错误格式（不要有多余的引号或空格）
DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
DATABASE_URL= postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
```

#### 方案 3: 检查密码中的特殊字符

如果密码包含特殊字符（如 `@`, `#`, `$`, `%` 等），需要进行 URL 编码：

- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

示例：
```env
# 如果密码是: my@pass#word
DATABASE_URL=postgresql://postgres:my%40pass%23word@db.xxxxx.supabase.co:5432/postgres
```

#### 方案 4: 检查网络连接

1. **检查 Supabase 项目状态**：
   - 访问 Supabase Dashboard
   - 确认项目状态为 "Active"
   - 检查是否有维护通知

2. **检查防火墙设置**：
   - 确保可以访问 Supabase 服务器
   - 检查公司/学校网络是否阻止了数据库连接

3. **测试连接**：
   ```bash
   # 使用 psql 测试连接（如果已安装）
   psql "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
   ```

#### 方案 5: 检查 Supabase 项目设置

1. **确认数据库密码**：
   - 如果忘记了密码，可以在 Supabase Dashboard 中重置
   - Settings → Database → Reset database password

2. **检查 IP 白名单**：
   - Settings → Database → Connection pooling
   - 如果启用了 IP 限制，确保你的 IP 在允许列表中

### 常见错误消息和解决方案

#### "Can't reach database server"
- **原因**: 网络连接问题或服务器不可用
- **解决**: 
  1. 检查 Supabase 项目状态
  2. 检查网络连接
  3. 尝试使用连接池 URL（端口 6543）

#### "Max clients reached" 或 "Too many clients"
- **原因**: 连接池已满
- **解决**: 
  1. 使用连接池 URL（端口 6543）而不是直接连接（端口 5432）
  2. 检查是否有其他应用在使用连接
  3. 重启开发服务器以释放连接

#### "Authentication failed"
- **原因**: 用户名或密码错误
- **解决**: 
  1. 检查 DATABASE_URL 中的用户名和密码
  2. 在 Supabase Dashboard 中重置密码
  3. 确保密码中的特殊字符已正确编码

#### "Database does not exist"
- **原因**: 数据库名称错误
- **解决**: 
  1. Supabase 的默认数据库名是 `postgres`
  2. 检查 DATABASE_URL 中的数据库名

### 验证连接

运行以下命令验证数据库连接：

```bash
# 生成 Prisma 客户端
npm run db:generate

# 推送数据库 schema（会测试连接）
npm run db:push
```

如果连接成功，你会看到：
```
✔ Generated Prisma Client
✔ Database synchronized
```

### 调试步骤

1. **查看服务器日志**：
   启动开发服务器后，查看控制台输出：
   ```
   [Prisma] ✅ 数据库连接成功
   ```
   或
   ```
   [Prisma] ❌ 数据库连接失败: ...
   ```

2. **使用调试 API**：
   访问：`http://localhost:3000/api/debug/login-status?email=your@email.com`
   
   检查返回的 `environment.hasDatabaseUrl` 是否为 `true`

3. **检查环境变量加载**：
   ```bash
   node -e "require('dotenv').config(); console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已配置' : '未配置');"
   ```

### 需要更多帮助？

如果问题仍然存在，请提供：

1. **服务器日志**（包含 `[Prisma]` 标记的日志）
2. **DATABASE_URL 格式**（隐藏密码，只显示格式）
3. **Supabase 项目状态**（Dashboard 中显示的状态）
4. **错误消息的完整内容**
