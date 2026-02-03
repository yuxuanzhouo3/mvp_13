# 🚀 快速开始指南

## 步骤1: 生成数据库和启动

在项目根目录执行以下命令：

```bash
# 1. 生成 Prisma 客户端
npm run db:generate

# 2. 创建数据库并推送 schema
npm run db:push

# 3. （可选）填充测试数据
npm run db:seed

# 4. 启动开发服务器
npm run dev
```

## 步骤2: 访问应用

打开浏览器访问：http://localhost:3000

## 步骤3: 测试功能

### 快速测试流程：

1. **注册账号**
   - 访问：http://localhost:3000/auth/signup
   - 注册一个租客账号：`tenant@test.com` / `password123`
   - 注册一个房东账号：`landlord@test.com` / `password123`

2. **测试 AI 搜索（使用 API）**

打开浏览器开发者工具的控制台，或使用 Postman/curl：

```javascript
// 1. 登录获取 Token
fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'tenant@test.com',
    password: 'password123'
  })
})
.then(r => r.json())
.then(data => {
  const token = data.token;
  console.log('Token:', token);
  
  // 2. 测试 AI 搜索
  return fetch('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query: '我需要三公里以内的价格2000-2500的房子，长租6个月以上',
      userType: 'TENANT'
    })
  });
})
.then(r => r.json())
.then(data => console.log('搜索结果:', data));
```

3. **创建房源（房东）**

```javascript
// 使用房东 Token
fetch('http://localhost:3000/api/properties', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer LANDLORD_TOKEN'
  },
  body: JSON.stringify({
    title: 'Modern Downtown Apartment',
    description: 'Beautiful apartment',
    address: '123 Main St',
    city: 'Seattle',
    state: 'WA',
    zipCode: '98101',
    price: 2800,
    deposit: 2800,
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1200,
    propertyType: 'APARTMENT',
    images: ['/placeholder.svg'],
    amenities: ['parking', 'gym'],
    petFriendly: true
  })
})
.then(r => r.json())
.then(data => console.log('创建的房源:', data));
```

## 📋 详细测试场景

查看 `TESTING_GUIDE.md` 获取完整的测试场景和 API 文档。

## ⚠️ 注意事项

- SQLite 数据库文件会创建在 `prisma/dev.db`
- 所有数据都存储在本地文件中
- 如需切换到 PostgreSQL，只需修改 `prisma/schema.prisma` 中的 `datasource`

## 🐛 问题排查

如果遇到问题：

1. **数据库错误**: 确保已运行 `npm run db:push`
2. **Token 错误**: 重新登录获取新 Token
3. **端口占用**: 确保 3000 端口未被占用
