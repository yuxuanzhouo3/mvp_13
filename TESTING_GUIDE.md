# RentGuard 测试指南

## 🚀 快速开始

### 1. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run db:generate

# 创建数据库并推送 schema
npm run db:push

# （可选）填充测试数据
npm run db:seed
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 http://localhost:3000 启动

---

## 📋 测试场景

### 场景1: 用户注册和登录

#### 步骤：
1. 访问 http://localhost:3000/auth/signup
2. 填写注册信息：
   - Email: `tenant@test.com`
   - Password: `password123`
   - Name: `测试租客`
   - User Type: 选择 `Tenant`
3. 点击 "Create Account"
4. 注册成功后，使用相同信息登录

#### 预期结果：
- ✅ 成功注册并返回 JWT Token
- ✅ 可以成功登录
- ✅ 登录后跳转到租客面板

---

### 场景2: AI对话搜索房源（租客端）

#### 前置条件：
- 已注册并登录为租客用户

#### 步骤：
1. 访问 http://localhost:3000/dashboard/tenant
2. 找到 AI 对话搜索功能（或直接调用 API）
3. 使用以下测试查询：

**测试查询1：基础搜索**
```
我需要三公里以内的价格2000-2500的房子，长租6个月以上
```

**测试查询2：详细条件**
```
找西雅图2室1卫，允许宠物的公寓，价格不超过3000美元
```

**测试查询3：中文查询**
```
我需要在北京，月租5000-8000元，至少租12个月的房子
```

#### API 测试方式：

使用 Postman 或 curl：

```bash
# 先登录获取 Token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tenant@test.com",
    "password": "password123"
  }'

# 使用返回的 token 进行 AI 搜索
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "我需要三公里以内的价格2000-2500的房子，长租6个月以上",
    "userType": "TENANT"
  }'
```

#### 预期结果：
- ✅ AI 正确解析查询条件（价格范围、距离、租期等）
- ✅ 返回匹配的房源列表
- ✅ 搜索结果包含自己的数据库和第三方平台的模拟数据
- ✅ 搜索需求被保存到数据库

---

### 场景3: 创建房源（房东端）

#### 前置条件：
- 注册一个房东账号：`landlord@test.com`

#### 步骤：
1. 访问 http://localhost:3000/dashboard/landlord
2. 点击 "Add Property" 或直接调用 API

#### API 测试：

```bash
# 使用房东账号登录获取 Token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "landlord@test.com",
    "password": "password123"
  }'

# 创建房源
curl -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Modern Downtown Apartment",
    "description": "Beautiful modern apartment in downtown Seattle",
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
    "images": ["/placeholder.svg?height=200&width=300"],
    "amenities": ["parking", "gym", "laundry"],
    "petFriendly": true,
    "availableFrom": "2024-02-01",
    "leaseDuration": 12
  }'
```

#### 预期结果：
- ✅ 成功创建房源
- ✅ 房源出现在房东的房源列表中
- ✅ 房源可以被租客搜索到

---

### 场景4: 房源搜索和筛选

#### 步骤：
1. 访问 http://localhost:3000/dashboard/tenant
2. 使用搜索功能或调用 API

#### API 测试：

```bash
# 搜索房源
curl -X GET "http://localhost:3000/api/properties/search?city=Seattle&maxPrice=3000&minBedrooms=2" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 预期结果：
- ✅ 返回符合条件的房源
- ✅ 支持多条件筛选（城市、价格、房间数等）

---

### 场景5: 申请房源（租客端）

#### 前置条件：
- 租客已登录
- 已创建至少一个房源

#### 步骤：
1. 在房源详情页点击 "Apply"
2. 填写申请信息

#### API 测试：

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TENANT_TOKEN" \
  -d '{
    "propertyId": "PROPERTY_ID",
    "monthlyIncome": 8500,
    "creditScore": 750,
    "depositAmount": 2800,
    "message": "I am very interested in this property"
  }'
```

#### 预期结果：
- ✅ 成功创建申请
- ✅ 申请出现在房东的申请列表中
- ✅ 申请状态为 "PENDING"

---

### 场景6: 审核申请（房东端）

#### 前置条件：
- 房东已登录
- 有待审核的申请

#### 步骤：
1. 访问 http://localhost:3000/dashboard/landlord
2. 进入 "Applications" 标签
3. 审核申请

#### API 测试：

```bash
# 获取申请列表
curl -X GET http://localhost:3000/api/applications?userType=landlord \
  -H "Authorization: Bearer LANDLORD_TOKEN"

# 审核申请（批准或拒绝）
curl -X PATCH http://localhost:3000/api/applications/APPLICATION_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer LANDLORD_TOKEN" \
  -d '{
    "status": "APPROVED"
  }'
```

#### 预期结果：
- ✅ 可以查看所有申请
- ✅ 可以批准或拒绝申请
- ✅ 申请状态更新

---

### 场景7: AI对话搜索租客（房东端）

#### 前置条件：
- 房东已登录

#### 步骤：
1. 使用 AI 对话功能搜索租客

#### API 测试：

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer LANDLORD_TOKEN" \
  -d '{
    "query": "我需要能长租半年以上租金到3000美元的房客",
    "userType": "LANDLORD"
  }'
```

#### 预期结果：
- ✅ AI 正确解析查询条件（租期、租金要求等）
- ✅ 返回匹配的租客列表
- ✅ 搜索结果包含自己的数据库和第三方平台的模拟数据

---

### 场景8: 押金管理（年费会员功能）

#### 前置条件：
- 用户已升级为年费会员
- 有已批准的申请

#### 步骤：
1. 升级会员（调用 API）
2. 创建押金记录

#### API 测试：

```bash
# 升级会员
curl -X POST http://localhost:3000/api/membership/upgrade \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "paymentMethod": "credit_card",
    "transactionId": "txn-123456"
  }'

# 创建押金记录
curl -X POST http://localhost:3000/api/deposits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "propertyId": "PROPERTY_ID",
    "amount": 2800,
    "expectedReturn": "2024-12-31"
  }'

# 查询押金列表
curl -X GET http://localhost:3000/api/deposits \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 预期结果：
- ✅ 成功升级会员
- ✅ 可以创建押金记录
- ✅ 可以查询押金状态

---

### 场景9: 争议解决

#### 前置条件：
- 有押金记录

#### API 测试：

```bash
# 创建争议
curl -X POST http://localhost:3000/api/disputes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "depositId": "DEPOSIT_ID",
    "reason": "Dispute over deposit deduction",
    "claim": "The landlord deducted too much for cleaning"
  }'

# 查询争议列表
curl -X GET http://localhost:3000/api/disputes \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 预期结果：
- ✅ 可以创建争议
- ✅ 可以查询争议列表
- ✅ 押金状态更新为 "DISPUTED"

---

### 场景10: 搜索需求历史

#### API 测试：

```bash
# 查询租客搜索历史
curl -X GET http://localhost:3000/api/requests/tenant \
  -H "Authorization: Bearer TENANT_TOKEN"

# 查询房东搜索历史
curl -X GET http://localhost:3000/api/requests/landlord \
  -H "Authorization: Bearer LANDLORD_TOKEN"
```

#### 预期结果：
- ✅ 返回所有历史搜索记录
- ✅ 包含搜索条件和结果

---

## 🧪 完整测试流程

### 端到端测试流程：

1. **注册两个账号**
   - 租客：`tenant@test.com`
   - 房东：`landlord@test.com`

2. **房东创建房源**
   - 创建至少 3-5 个不同条件的房源

3. **租客使用 AI 搜索**
   - 测试不同的搜索查询
   - 验证搜索结果

4. **租客申请房源**
   - 对感兴趣的房源提交申请

5. **房东审核申请**
   - 批准部分申请
   - 拒绝部分申请

6. **升级会员并测试押金功能**
   - 升级为年费会员
   - 创建押金记录
   - 测试争议功能

---

## 📊 验证检查清单

- [ ] 用户注册和登录功能正常
- [ ] AI 对话搜索能正确解析自然语言
- [ ] 房源创建和查询功能正常
- [ ] 申请流程完整（创建、审核）
- [ ] 押金管理功能正常（需要会员）
- [ ] 争议解决功能正常
- [ ] 搜索需求被正确保存
- [ ] 第三方平台搜索返回模拟数据
- [ ] 所有 API 返回正确的数据格式
- [ ] 错误处理正确（未授权、参数错误等）

---

## 🐛 常见问题排查

### 问题1: 数据库连接错误
**解决**: 确保已运行 `npm run db:push` 创建数据库

### 问题2: JWT Token 无效
**解决**: 重新登录获取新的 Token

### 问题3: AI 搜索返回空结果
**解决**: 检查是否有房源数据，或运行 `npm run db:seed` 填充测试数据

### 问题4: 权限错误（403）
**解决**: 确保使用正确的用户类型（租客/房东）和 Token

---

## 📝 测试数据

运行以下命令填充测试数据：

```bash
npm run db:seed
```

这将创建：
- 测试租客账号
- 测试房东账号
- 示例房源数据

---

## 🎯 重点测试功能

1. **AI 自然语言解析** - 核心功能
2. **第三方平台搜索** - 模拟数据返回
3. **数据持久化** - 搜索需求入库
4. **会员系统** - 押金保管服务
5. **完整业务流程** - 从搜索到申请到押金

---

祝测试顺利！如有问题，请查看控制台日志或 API 返回的错误信息。
