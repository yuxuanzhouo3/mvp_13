# 快速修复数据库连接问题

## 问题：显示 "Database connection failed, please try again later"

### 立即检查步骤

#### 1. 使用调试 API 检查连接

访问以下 URL 检查数据库连接状态：
```
http://localhost:3000/api/debug/db-connection
```

这会返回：
- DATABASE_URL 是否配置
- 连接信息（主机、端口等）
- 连接测试结果
- 问题诊断和建议

#### 2. 检查 .env 文件

确保项目根目录有 `.env` 或 `.env.local` 文件，并且包含：

```env
DATABASE_URL=postgresql://postgres:你的密码@db.xxxxx.supabase.co:5432/postgres
```

**重要提示**：
- 不要有多余的引号：`DATABASE_URL="..."` ❌
- 不要有前后空格
- 密码中的特殊字符需要 URL 编码

#### 3. 使用 Supabase 连接池（推荐）

如果使用 Supabase，**强烈建议使用连接池 URL**：

1. 访问 Supabase Dashboard: https://app.supabase.com
2. 进入项目 → **Settings** → **Database**
3. 找到 **Connection string** 部分
4. 选择 **Connection pooling** 标签（不是 Session mode）
5. 复制连接字符串（端口应该是 **6543**）

更新 `.env` 文件：
```env
DATABASE_URL=postgresql://postgres:密码@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true
```

#### 4. 检查密码中的特殊字符

如果密码包含特殊字符，需要进行 URL 编码：

| 字符 | 编码 |
|------|------|
| @ | %40 |
| # | %23 |
| $ | %24 |
| % | %25 |
| & | %26 |
| + | %2B |
| = | %3D |

**示例**：
- 如果密码是：`my@pass#word`
- 编码后：`my%40pass%23word`
- 完整 URL：`postgresql://postgres:my%40pass%23word@db.xxxxx.supabase.co:5432/postgres`

#### 5. 验证 Supabase 项目状态

1. 访问 Supabase Dashboard
2. 检查项目状态是否为 **Active**
3. 检查是否有维护通知
4. 如果项目暂停，需要恢复项目

#### 6. 重启开发服务器

更新 `.env` 文件后，**必须重启开发服务器**：

```bash
# 停止服务器 (Ctrl+C)
npm run dev
```

### 常见问题快速解决

#### 问题 A: "Can't reach database server"

**原因**: 网络连接问题

**解决**:
1. 检查 DATABASE_URL 中的主机地址是否正确
2. 尝试使用连接池 URL（端口 6543）
3. 检查防火墙设置
4. 如果使用 VPN，尝试断开后重试

#### 问题 B: "Authentication failed"

**原因**: 用户名或密码错误

**解决**:
1. 在 Supabase Dashboard 中重置数据库密码
2. Settings → Database → Reset database password
3. 更新 DATABASE_URL 中的密码
4. 确保密码中的特殊字符已正确编码

#### 问题 C: "Max clients reached"

**原因**: 连接池已满

**解决**:
1. **使用连接池 URL**（端口 6543，不是 5432）
2. 等待几分钟后重试
3. 检查是否有其他应用在使用连接
4. 重启开发服务器以释放连接

#### 问题 D: 环境变量未加载

**原因**: Next.js 没有读取到环境变量

**解决**:
1. 确保文件名为 `.env.local`（推荐）或 `.env`
2. 文件必须在项目根目录（与 `package.json` 同级）
3. 重启开发服务器
4. 清除 Next.js 缓存：删除 `.next` 文件夹后重启

### 测试连接

#### 方法 1: 使用调试 API

访问：`http://localhost:3000/api/debug/db-connection`

查看返回的 JSON，检查：
- `connectionTest.status` 是否为 `"success"`
- 如果有 `diagnosis` 数组，查看建议

#### 方法 2: 查看服务器日志

启动开发服务器后，查看控制台输出：

**成功**：
```
[Prisma] ✅ 数据库连接成功
```

**失败**：
```
[Prisma] ❌ 数据库连接失败: ...
```

#### 方法 3: 使用 Prisma 命令

```bash
# 测试连接（会尝试推送 schema）
npm run db:push
```

如果连接成功，会看到：
```
✔ Database synchronized
```

### 需要帮助？

如果问题仍然存在，请提供：

1. **调试 API 响应**：
   - 访问 `http://localhost:3000/api/debug/db-connection`
   - 复制返回的 JSON（隐藏密码）

2. **服务器日志**：
   - 包含 `[Prisma]` 标记的日志
   - 包含 `[loginWithJWT]` 标记的日志

3. **DATABASE_URL 格式**（隐藏密码）：
   ```
   postgresql://postgres:***@db.xxxxx.supabase.co:5432/postgres
   ```

4. **Supabase 项目状态**：
   - Dashboard 中显示的状态
   - 是否有任何警告或错误
