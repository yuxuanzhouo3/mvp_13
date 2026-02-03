# 🧪 API 测试完整指南（小白版）

## 📋 目录
1. [使用浏览器测试（最简单）](#方法1-使用浏览器测试最简单)
2. [使用浏览器开发者工具](#方法2-使用浏览器开发者工具)
3. [使用 Postman（推荐）](#方法3-使用-postman推荐)
4. [常见 API 测试示例](#常见-api-测试示例)

---

## 方法1: 使用浏览器测试（最简单）

### 步骤1: 启动服务器

```bash
npm run dev
```

### 步骤2: 打开浏览器

访问 http://localhost:3000

### 步骤3: 测试注册

1. 点击右上角 "Sign Up"
2. 填写信息：
   - Email: `test@example.com`
   - Password: `password123`
   - 选择用户类型（Tenant 或 Landlord）
3. 点击 "Create Account"
4. 如果成功，会自动跳转到 dashboard

### 步骤4: 测试登录

1. 点击右上角 "Login"
2. 输入刚才注册的邮箱和密码
3. 点击 "Sign In"
4. 如果成功，会跳转到 dashboard

### 步骤5: 测试 AI 搜索

1. 登录后进入 dashboard
2. 点击 "AI 智能搜索" 标签
3. 输入查询，例如：
   - 租客：`我需要三公里以内的价格2000-2500的房子，长租6个月以上`
   - 房东：`我需要能长租半年以上租金到3000美元的房客`
4. 点击发送按钮
5. 等待结果返回

---

## 方法2: 使用浏览器开发者工具

### 步骤1: 打开开发者工具

- **Chrome/Edge**: 按 `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Firefox**: 按 `F12` 或 `Ctrl+Shift+I`

### 步骤2: 切换到 Console（控制台）标签

### 步骤3: 测试 API

在控制台中输入以下代码：

#### 测试1: 注册

```javascript
fetch('http://localhost:3000/api/auth/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test2@example.com',
    password: 'password123',
    name: 'Test User',
    userType: 'TENANT'
  })
})
.then(response => response.json())
.then(data => {
  console.log('注册结果:', data)
  if (data.token) {
    localStorage.setItem('auth-token', data.token)
    console.log('Token 已保存')
  }
})
.catch(error => console.error('错误:', error))
```

#### 测试2: 登录

```javascript
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  })
})
.then(response => response.json())
.then(data => {
  console.log('登录结果:', data)
  if (data.token) {
    localStorage.setItem('auth-token', data.token)
    console.log('Token 已保存:', data.token)
  }
})
.catch(error => console.error('错误:', error))
```

#### 测试3: AI 搜索（需要先登录）

```javascript
// 先获取 token
const token = localStorage.getItem('auth-token')
if (!token) {
  console.log('请先登录')
} else {
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
  .then(response => response.json())
  .then(data => {
    console.log('搜索结果:', data)
  })
  .catch(error => console.error('错误:', error))
}
```

#### 测试4: 搜索房源

```javascript
const token = localStorage.getItem('auth-token')
fetch('http://localhost:3000/api/properties/search?city=Seattle&maxPrice=3000', {
  headers: token ? { 'Authorization': `Bearer ${token}` } : {}
})
.then(response => response.json())
.then(data => {
  console.log('房源列表:', data)
})
.catch(error => console.error('错误:', error))
```

---

## 方法3: 使用 Postman（推荐）

### 步骤1: 下载 Postman

1. 访问 https://www.postman.com/downloads/
2. 下载并安装 Postman
3. 打开 Postman

### 步骤2: 创建请求

#### 测试1: 注册

1. 点击 "New" → "HTTP Request"
2. 设置：
   - **Method**: `POST`
   - **URL**: `http://localhost:3000/api/auth/signup`
3. 点击 "Body" 标签
4. 选择 "raw" 和 "JSON"
5. 输入：
```json
{
  "email": "test3@example.com",
  "password": "password123",
  "name": "Test User",
  "userType": "TENANT"
}
```
6. 点击 "Send"
7. 查看响应，复制返回的 `token`

#### 测试2: 登录

1. 新建请求
2. 设置：
   - **Method**: `POST`
   - **URL**: `http://localhost:3000/api/auth/login`
3. **Body** (JSON):
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```
4. 点击 "Send"
5. 复制返回的 `token`

#### 测试3: 设置 Authorization

1. 在 Postman 中，点击右上角的 "Environments"
2. 创建新环境，添加变量：
   - **Variable**: `token`
   - **Initial Value**: 粘贴刚才复制的 token
3. 在请求中，点击 "Authorization" 标签
4. 选择 "Bearer Token"
5. 输入 `{{token}}` 或直接粘贴 token

#### 测试4: AI 搜索

1. 新建请求
2. 设置：
   - **Method**: `POST`
   - **URL**: `http://localhost:3000/api/ai/chat`
   - **Authorization**: Bearer Token (使用刚才设置的 token)
3. **Body** (JSON):
```json
{
  "query": "我需要三公里以内的价格2000-2500的房子，长租6个月以上",
  "userType": "TENANT"
}
```
4. 点击 "Send"
5. 查看搜索结果

#### 测试5: 搜索房源

1. 新建请求
2. 设置：
   - **Method**: `GET`
   - **URL**: `http://localhost:3000/api/properties/search?city=Seattle&maxPrice=3000`
   - **Authorization**: Bearer Token
3. 点击 "Send"

---

## 常见 API 测试示例

### 1. 注册用户

```bash
POST http://localhost:3000/api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "userType": "TENANT"
}
```

### 2. 登录

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### 3. AI 对话搜索（租客）

```bash
POST http://localhost:3000/api/ai/chat
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "query": "我需要三公里以内的价格2000-2500的房子，长租6个月以上",
  "userType": "TENANT"
}
```

### 4. AI 对话搜索（房东）

```bash
POST http://localhost:3000/api/ai/chat
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "query": "我需要能长租半年以上租金到3000美元的房客",
  "userType": "LANDLORD"
}
```

### 5. 搜索房源

```bash
GET http://localhost:3000/api/properties/search?city=Seattle&maxPrice=3000&minBedrooms=2
Authorization: Bearer YOUR_TOKEN
```

### 6. 创建房源（房东）

```bash
POST http://localhost:3000/api/properties
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "title": "Beautiful Apartment",
  "description": "Modern apartment in downtown",
  "address": "123 Main St",
  "city": "Seattle",
  "state": "WA",
  "zipCode": "98101",
  "price": 2800,
  "deposit": 2800,
  "bedrooms": 2,
  "bathrooms": 2,
  "sqft": 1200,
  "propertyType": "APARTMENT",
  "images": [],
  "amenities": []
}
```

### 7. 申请房源

```bash
POST http://localhost:3000/api/applications
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "propertyId": "PROPERTY_ID",
  "monthlyIncome": 8500,
  "creditScore": 750,
  "depositAmount": 2800,
  "message": "I'm very interested in this property"
}
```

---

## 🔍 如何查看响应结果

### 在浏览器控制台

结果会直接显示在控制台中，例如：
```
注册结果: {user: {...}, token: "eyJhbGc..."}
```

### 在 Postman

1. 点击 "Send" 后
2. 在下方查看 "Response"
3. 可以选择 "Pretty" 查看格式化的 JSON
4. 可以选择 "Raw" 查看原始数据

---

## ⚠️ 常见问题

### Q: 为什么返回 401 错误？

A: 说明没有提供有效的 Token。需要先登录获取 Token。

### Q: 为什么返回 404 错误？

A: 检查 URL 是否正确，确保服务器正在运行。

### Q: 如何获取 Token？

A: 登录后，Token 会保存在浏览器的 localStorage 中。在控制台输入：
```javascript
localStorage.getItem('auth-token')
```

### Q: Token 过期了怎么办？

A: 重新登录获取新的 Token。

---

## 📝 快速测试清单

- [ ] 服务器正在运行 (`npm run dev`)
- [ ] 可以访问 http://localhost:3000
- [ ] 可以注册新账号
- [ ] 可以登录
- [ ] 可以搜索房源
- [ ] 可以使用 AI 搜索功能
- [ ] 可以创建房源（房东）
- [ ] 可以申请房源（租客）

---

## 🎯 推荐测试流程

1. **使用浏览器界面测试**（最简单）
   - 注册 → 登录 → 使用 AI 搜索

2. **使用浏览器控制台测试**（中等难度）
   - 测试各个 API 端点
   - 查看返回数据

3. **使用 Postman 测试**（最专业）
   - 创建请求集合
   - 保存常用请求
   - 测试所有功能

现在你可以开始测试了！🚀
