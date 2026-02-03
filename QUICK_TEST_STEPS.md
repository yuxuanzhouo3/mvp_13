# 🚀 快速测试步骤（小白版）

## ✅ 已完成的修复

1. ✅ 移除了注册页面的 Name 字段
2. ✅ 添加了 AI 对话窗口到租客和房东 dashboard
3. ✅ 修复了搜索功能
4. ✅ 所有页面路由已创建

---

## 📋 完整测试步骤

### 步骤1: 启动服务器

在项目根目录打开终端，运行：

```bash
npm run dev
```

等待看到：
```
▲ Next.js 15.2.6
- Local:        http://localhost:3000
```

### 步骤2: 打开浏览器

访问：http://localhost:3000

### 步骤3: 测试注册（无需输入 Name）

1. 点击右上角 **"Sign Up"** 按钮
2. 选择用户类型（Tenant 或 Landlord）
3. 填写：
   - **Email**: `test@example.com`
   - **Password**: `password123`
   - **Confirm Password**: `password123`
4. 点击 **"Create Account"**
5. ✅ 应该成功注册并自动跳转到 dashboard

### 步骤4: 测试登录

1. 如果已注册，点击右上角 **"Login"**
2. 输入：
   - **Email**: `test@example.com`
   - **Password**: `password123`
3. 点击 **"Sign In"**
4. ✅ 应该成功登录并跳转到 dashboard

### 步骤5: 测试 AI 智能搜索（核心功能）

#### 租客端：

1. 登录后进入租客 dashboard (`/dashboard/tenant`)
2. 点击顶部标签栏的 **"AI 智能搜索"**（第一个标签）
3. 在输入框中输入自然语言查询，例如：
   ```
   我需要三公里以内的价格2000-2500的房子，长租6个月以上
   ```
4. 点击发送按钮（或按 Enter）
5. ✅ 应该看到搜索结果，包括：
   - 解析后的搜索条件
   - 匹配的房源列表
   - 第三方平台的搜索结果

#### 房东端：

1. 注册一个房东账号并登录
2. 进入房东 dashboard (`/dashboard/landlord`)
3. 点击 **"AI 智能搜索"** 标签
4. 输入查询，例如：
   ```
   我需要能长租半年以上租金到3000美元的房客
   ```
5. ✅ 应该看到匹配的租客列表

### 步骤6: 测试首页搜索

1. 返回首页 (http://localhost:3000)
2. 在首页的搜索框中输入：`Seattle`
3. 点击 **"Search"** 按钮
4. ✅ 应该跳转到搜索页面并显示结果

### 步骤7: 测试导航链接

点击导航栏的各个链接：
- ✅ **Find Homes** → 跳转到搜索页面
- ✅ **List Property** → 跳转到发布房源页面
- ✅ **How it Works** → 跳转到使用说明页面
- ✅ **Deposit Protection** → 跳转到押金保护页面

---

## 🎯 AI 对话功能位置

### 租客端：
1. 登录后访问：http://localhost:3000/dashboard/tenant
2. 点击顶部第一个标签：**"AI 智能搜索"**
3. 输入自然语言查询即可

### 房东端：
1. 登录后访问：http://localhost:3000/dashboard/landlord
2. 点击顶部第一个标签：**"AI 智能搜索"**
3. 输入自然语言查询即可

---

## 📝 测试示例查询

### 租客查询示例：

1. **基础搜索**：
   ```
   我需要三公里以内的价格2000-2500的房子，长租6个月以上
   ```

2. **详细条件**：
   ```
   找西雅图2室1卫，允许宠物的公寓，价格不超过3000美元
   ```

3. **中文查询**：
   ```
   我需要在北京，月租5000-8000元，至少租12个月的房子
   ```

### 房东查询示例：

1. **基础搜索**：
   ```
   我需要能长租半年以上租金到3000美元的房客
   ```

2. **详细条件**：
   ```
   找信用分数700以上，月收入至少5000的租客
   ```

---

## 🔍 如何查看 API 响应（浏览器控制台）

如果你想查看 API 返回的原始数据：

1. 按 `F12` 打开开发者工具
2. 点击 **"Console"**（控制台）标签
3. 在控制台中输入以下代码查看 Token：

```javascript
// 查看当前保存的 Token
localStorage.getItem('auth-token')

// 查看当前用户信息
JSON.parse(localStorage.getItem('user') || '{}')
```

4. 测试 AI 搜索 API：

```javascript
// 获取 Token
const token = localStorage.getItem('auth-token')

// 调用 AI 搜索
fetch('http://localhost:3000/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: '我需要三公里以内的价格2000-2500的房子，长租6个月以上',
    userType: 'TENANT'
  })
})
.then(r => r.json())
.then(data => console.log('搜索结果:', data))
```

---

## ⚠️ 常见问题

### Q: 点击搜索按钮没有反应？

A: 检查：
1. 是否已登录（某些功能需要登录）
2. 打开浏览器控制台（F12）查看是否有错误信息
3. 确保服务器正在运行

### Q: AI 搜索没有返回结果？

A: 
1. 确保已登录
2. 检查数据库中是否有房源数据（运行 `npm run db:seed` 填充测试数据）
3. 查看控制台是否有错误信息

### Q: 找不到 AI 对话窗口？

A: 
- 租客：登录后进入 `/dashboard/tenant`，点击第一个标签 **"AI 智能搜索"**
- 房东：登录后进入 `/dashboard/landlord`，点击第一个标签 **"AI 智能搜索"**

### Q: 注册时提示错误？

A: 
1. 确保邮箱格式正确
2. 密码至少6个字符
3. 两次输入的密码必须一致

---

## 📚 详细文档

- `API_TESTING_GUIDE.md` - 完整的 API 测试指南（包含 Postman 使用方法）
- `TESTING_GUIDE.md` - 详细测试场景
- `FRONTEND_BACKEND_CONNECTION.md` - 前后端连接说明

---

## ✅ 测试检查清单

- [ ] 可以注册新账号（无需输入 Name）
- [ ] 可以登录
- [ ] 可以访问 AI 智能搜索标签
- [ ] AI 搜索可以返回结果
- [ ] 首页搜索框可以跳转
- [ ] 导航栏链接都可以正常跳转
- [ ] 可以发布房源（房东）

现在所有功能都应该可以正常使用了！🎉
