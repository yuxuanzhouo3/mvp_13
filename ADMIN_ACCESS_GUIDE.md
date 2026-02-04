# 管理员后台访问指南

## 访问地址

管理员后台页面地址：`http://localhost:3000/dashboard/admin`

## 设置管理员权限

### 方法 1：通过环境变量（推荐）

在 `.env` 文件中添加：

```env
# 管理员用户 ID（多个用逗号分隔）
ADMIN_USER_IDS=user-id-1,user-id-2,user-id-3
```

### 方法 2：修改代码检查逻辑

在 `app/api/admin/stats/route.ts` 中修改 `isAdmin` 函数：

```typescript
function isAdmin(userId: string): boolean {
  // 方式1：通过环境变量
  if (process.env.ADMIN_USER_IDS?.split(',').includes(userId)) {
    return true
  }
  
  // 方式2：通过数据库查询用户角色
  // const user = await db.findUserById(userId)
  // return user?.userType === 'ADMIN'
  
  // 方式3：硬编码特定用户（仅用于测试）
  // return userId === 'your-user-id'
  
  return false
}
```

## 获取用户 ID

### 方法 1：通过注册/登录响应

注册或登录后，响应中会包含用户信息：

```json
{
  "user": {
    "id": "clx1234567890",  // 这就是用户 ID
    "email": "admin@example.com",
    "name": "Admin User",
    "userType": "TENANT"
  },
  "token": "..."
}
```

### 方法 2：通过数据库查询

```bash
# 使用 Prisma Studio
npx prisma studio

# 在浏览器中打开 http://localhost:5555
# 找到 User 表，查看用户的 id 字段
```

### 方法 3：通过 API 获取当前用户

```javascript
// 在浏览器控制台执行
const token = localStorage.getItem('auth-token')
fetch('/api/auth/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => console.log('User ID:', data.user?.id))
```

## 快速设置步骤

1. **注册一个账号**（如果还没有）
   - 访问：http://localhost:3000/auth/signup
   - 注册一个账号，记住邮箱

2. **获取用户 ID**
   - 登录后，打开浏览器开发者工具
   - 在 Console 中执行：
   ```javascript
   const user = JSON.parse(localStorage.getItem('user') || '{}')
   console.log('User ID:', user.id)
   ```

3. **设置环境变量**
   - 在 `.env` 文件中添加：
   ```env
   ADMIN_USER_IDS=你的用户ID
   ```

4. **重启开发服务器**
   ```bash
   # 停止当前服务器（Ctrl+C）
   npm run dev
   ```

5. **访问管理员后台**
   - 访问：http://localhost:3000/dashboard/admin
   - 如果显示"无权限访问"，检查：
     - 环境变量是否正确设置
     - 用户 ID 是否正确
     - 是否已重启服务器

## 功能说明

管理员后台提供以下功能：

1. **数据统计**
   - 用户统计（总用户、日活跃、月活跃）
   - 收入统计（总收入、日收入、月收入）
   - 订阅统计（总订阅、日订阅、月订阅、订阅分布）
   - 设备统计

2. **区域切换**
   - 全部：显示汇总数据
   - 国际版：仅显示国际版数据
   - 国内版：仅显示国内版数据

3. **时间筛选**
   - 今日：显示今日数据
   - 本月：显示本月数据
   - 全部：显示全部历史数据

## 注意事项

1. **权限检查**：只有管理员用户才能访问后台，普通用户会被重定向
2. **数据来源**：统计数据来自 Events 表/集合，确保已正确设置（见 `EVENTS_TABLE_SETUP.md`）
3. **环境变量**：修改环境变量后需要重启服务器才能生效

## 故障排查

### 问题：显示"无权限访问"

**解决方案**：
1. 检查 `.env` 文件中的 `ADMIN_USER_IDS` 是否正确设置
2. 确认用户 ID 是否正确（注意不要有多余的空格）
3. 重启开发服务器
4. 清除浏览器缓存，重新登录

### 问题：统计数据为空

**解决方案**：
1. 检查 Events 表/集合是否已创建
2. 确认有数据埋点记录（注册、登录等操作会触发埋点）
3. 检查数据库连接是否正常

### 问题：页面无法加载

**解决方案**：
1. 检查是否已登录（需要有效的 token）
2. 检查网络请求是否成功（打开开发者工具的 Network 标签）
3. 查看控制台错误信息
