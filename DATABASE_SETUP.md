# 数据库设置指南

## 问题：无法连接到 PostgreSQL 数据库

错误信息：`Can't reach database server at localhost:5432`

## 解决方案

### 方案1: 使用免费云数据库（推荐，最简单）

#### 选项A: Supabase（推荐）

1. **注册账号**
   - 访问 https://supabase.com
   - 点击 "Start your project"
   - 使用 GitHub 账号登录（或创建账号）

2. **创建项目**
   - 点击 "New Project"
   - 填写项目名称（如：rentguard）
   - 设置数据库密码（**请记住这个密码！**）
   - 选择区域（建议选择离你最近的）
   - 点击 "Create new project"

3. **获取连接字符串**
   - 等待项目创建完成（约2分钟）
   - 进入项目后，点击左侧菜单 "Settings" → "Database"
   - 找到 "Connection string" 部分
   - 选择 "URI" 标签
   - 复制连接字符串（格式类似：`postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`）

4. **更新 .env 文件**
   - 打开项目根目录的 `.env` 文件
   - 将 `DATABASE_URL` 替换为复制的连接字符串
   - 注意：将 `[YOUR-PASSWORD]` 替换为你设置的密码

#### 选项B: Neon（免费 PostgreSQL）

1. **注册账号**
   - 访问 https://neon.tech
   - 点击 "Sign Up" 注册账号

2. **创建项目**
   - 登录后点击 "Create Project"
   - 填写项目名称
   - 选择区域
   - 点击 "Create Project"

3. **获取连接字符串**
   - 项目创建后，会显示连接字符串
   - 复制连接字符串

4. **更新 .env 文件**
   - 将连接字符串粘贴到 `.env` 文件的 `DATABASE_URL`

#### 选项C: Railway（简单易用）

1. **注册账号**
   - 访问 https://railway.app
   - 使用 GitHub 账号登录

2. **创建数据库**
   - 点击 "New Project"
   - 选择 "Provision PostgreSQL"
   - 等待数据库创建

3. **获取连接字符串**
   - 点击数据库服务
   - 在 "Connect" 标签页找到连接字符串
   - 复制连接字符串

4. **更新 .env 文件**
   - 将连接字符串粘贴到 `.env` 文件的 `DATABASE_URL`

---

### 方案2: 本地安装 PostgreSQL

#### Windows 安装步骤

1. **下载 PostgreSQL**
   - 访问 https://www.postgresql.org/download/windows/
   - 下载 PostgreSQL 安装程序（推荐最新版本）

2. **安装 PostgreSQL**
   - 运行安装程序
   - 设置安装路径（默认即可）
   - **设置 postgres 用户密码**（请记住这个密码！）
   - 选择端口（默认 5432）
   - 完成安装

3. **启动 PostgreSQL 服务**
   - 按 `Win + R`，输入 `services.msc`
   - 找到 "postgresql-x64-xx" 服务
   - 右键点击 → "启动"（如果未启动）

4. **创建数据库**
   - 打开 "pgAdmin"（安装时自带）
   - 或使用命令行：
   ```bash
   psql -U postgres
   # 输入密码后执行：
   CREATE DATABASE rentguard;
   \q
   ```

5. **更新 .env 文件**
   ```env
   DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/rentguard?schema=public
   ```

#### 验证本地 PostgreSQL 是否运行

在 PowerShell 中运行：
```powershell
Get-Service -Name "*postgresql*"
```

如果看到服务状态为 "Running"，说明服务已启动。

---

## 更新 .env 文件后

1. **验证连接**
   ```bash
   npm run db:push
   ```

2. **如果成功，你会看到：**
   ```
   ✔ Generated Prisma Client
   ✔ Database synchronized
   ```

3. **如果还有错误，检查：**
   - `.env` 文件中的 `DATABASE_URL` 是否正确
   - 密码是否正确（注意特殊字符需要 URL 编码）
   - 数据库服务器是否可访问

---

## 快速测试连接

更新 `.env` 后，可以运行：

```bash
# 生成 Prisma 客户端
npm run db:generate

# 推送数据库 schema
npm run db:push
```

---

## 常见问题

### Q: 连接字符串中的密码包含特殊字符怎么办？

A: 需要对特殊字符进行 URL 编码：
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

### Q: Supabase 连接字符串格式是什么？

A: 格式如下：
```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
```

将 `[YOUR-PASSWORD]` 替换为你的实际密码。

### Q: 如何检查数据库是否连接成功？

A: 运行 `npm run db:push`，如果看到 "Database synchronized" 说明连接成功。

---

## 推荐方案

**对于开发环境，强烈推荐使用 Supabase**：
- ✅ 免费额度大（500MB 数据库，2GB 带宽）
- ✅ 无需安装配置
- ✅ 自动备份
- ✅ 有 Web 界面管理数据
- ✅ 设置简单，5分钟搞定
