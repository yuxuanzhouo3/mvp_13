# 快速登录问题诊断

## 问题：显示 "Invalid email or password"

### 步骤 1: 检查服务器日志

启动开发服务器后，尝试登录，查看控制台输出。你应该看到类似这样的日志：

```
[Login] 国际版模式，尝试 Supabase 登录
[loginWithSupabase] 开始 Supabase 登录: { email: 'your@email.com' }
[Login] Supabase 登录失败，降级到 JWT: Invalid login credentials
[loginWithJWT] 开始 JWT 登录: { email: 'your@email.com' }
[loginWithJWT] 数据库查询结果: { found: true, hasPassword: true, userId: '...' }
[loginWithJWT] 密码验证结果: { isValid: false }
[loginWithJWT] ❌ 密码错误: your@email.com
```

### 步骤 2: 使用调试 API 检查配置

访问以下 URL（替换为你的邮箱）：

```
http://localhost:3000/api/debug/login-status?email=your@email.com
```

这会返回：
- 环境变量配置状态
- Supabase 初始化状态
- 用户在数据库中的状态

### 步骤 3: 常见问题和解决方案

#### 问题 A: 用户在 Supabase Auth 中，但密码不对

**症状**: 日志显示 `Supabase 登录失败: Invalid login credentials`

**解决**:
1. 在 Supabase Dashboard 中重置密码：
   - 访问 https://app.supabase.com
   - 进入你的项目 → Authentication → Users
   - 找到用户 → 点击 "Reset Password" 或手动设置密码

2. 或者使用 Supabase CLI：
   ```bash
   supabase auth reset-password --email your@email.com
   ```

#### 问题 B: 用户不在数据库中

**症状**: 日志显示 `[loginWithJWT] ❌ 用户不存在`

**解决**:
1. 检查数据库连接：
   - 确保 `DATABASE_URL` 正确配置
   - 确保数据库可以访问

2. 重新注册用户：
   - 访问 `/auth/signup`
   - 使用相同的邮箱注册

#### 问题 C: 用户在数据库中，但没有密码哈希

**症状**: 日志显示 `[loginWithJWT] ❌ 用户没有密码（可能是 Supabase 用户）`

**原因**: 用户是通过 Supabase Auth 创建的，密码由 Supabase 管理，不在数据库中

**解决**:
1. 确保 Supabase 配置正确
2. 使用 Supabase Auth 的密码登录
3. 或者在数据库中为用户设置密码（需要管理员操作）

#### 问题 D: 密码验证失败

**症状**: 日志显示 `[loginWithJWT] ❌ 密码错误`

**解决**:
1. 确认你输入的密码是正确的
2. 如果忘记了密码：
   - 如果用户在 Supabase Auth 中：使用 Supabase Dashboard 重置
   - 如果用户在数据库中：需要管理员重置密码哈希

### 步骤 4: 检查环境变量

确保 `.env.local` 或 `.env` 文件中有以下变量：

```env
NEXT_PUBLIC_APP_REGION=global
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=your-secret-key
```

**注意**: 
- 如果 `SUPABASE_SERVICE_ROLE_KEY` 未配置，系统会使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，但功能可能受限
- 确保所有值都是正确的，没有多余的空格或引号

### 步骤 5: 验证 Supabase 配置

1. 访问 Supabase Dashboard: https://app.supabase.com
2. 选择你的项目
3. 进入 Settings → API
4. 确认：
   - Project URL 与 `NEXT_PUBLIC_SUPABASE_URL` 一致
   - anon public key 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 一致
   - service_role key 与 `SUPABASE_SERVICE_ROLE_KEY` 一致（如果配置了）

### 步骤 6: 检查用户状态

#### 在 Supabase Dashboard 中：

1. 进入 Authentication → Users
2. 搜索你的邮箱
3. 检查：
   - 用户是否存在
   - 邮箱是否已验证
   - 最后登录时间

#### 在数据库中：

1. 进入 Database → Table Editor
2. 打开 `User` 表
3. 搜索你的邮箱
4. 检查：
   - 用户是否存在
   - `password` 字段是否有值（JWT 登录需要）

### 步骤 7: 测试登录流程

1. **清除浏览器缓存和 localStorage**:
   ```javascript
   // 在浏览器控制台运行
   localStorage.clear()
   ```

2. **重启开发服务器**:
   ```bash
   # 停止服务器 (Ctrl+C)
   npm run dev
   ```

3. **尝试登录并查看日志**

### 需要更多帮助？

如果问题仍然存在，请提供：

1. **服务器日志**（包含所有 `[Login]` 和 `[loginWithJWT]` 标记的日志）
2. **调试 API 响应**（访问 `/api/debug/login-status?email=your@email.com`）
3. **环境变量状态**（隐藏敏感信息，只显示是否配置）
4. **Supabase Dashboard 中的用户状态**
5. **数据库中的用户记录**（隐藏敏感信息）
