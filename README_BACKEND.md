# RentGuard 后端API文档

## 项目概述

RentGuard是一个AI驱动的租房平台，提供以下核心功能：

1. **AI对话搜索** - 租客和房东可以通过自然语言查询搜索房源/租客
2. **第三方平台集成** - 自动搜索主流租房/求租平台
3. **押金保管服务** - 年费会员可享受第三方押金保管服务
4. **争议解决** - 公平公正的押金退还机制

## 技术栈

- **框架**: Next.js 15 (App Router)
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: JWT
- **AI服务**: OpenAI API (可选)
- **密码加密**: bcryptjs

## 环境配置

1. 复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

2. 配置数据库连接：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rentguard?schema=public"
```

3. 初始化数据库：

```bash
# 安装依赖
pnpm install

# 生成Prisma客户端
pnpm db:generate

# 推送数据库schema
pnpm db:push

# 或使用迁移
pnpm db:migrate
```

## API端点

### 认证

#### POST `/api/auth/signup`
注册新用户

**请求体:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "+1234567890",
  "userType": "TENANT" | "LANDLORD" | "AGENT"
}
```

#### POST `/api/auth/login`
用户登录

**请求体:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应:**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "TENANT",
    "isPremium": false
  },
  "token": "jwt-token"
}
```

### AI对话

#### POST `/api/ai/chat`
AI对话搜索（租客搜索房源 / 房东搜索租客）

**请求头:**
```
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "query": "我需要三公里以内的价格2000-2500的房子，长租6个月以上",
  "userType": "TENANT" // 或 "LANDLORD"
}
```

**响应:**
```json
{
  "success": true,
  "query": "原始查询",
  "parsedCriteria": {
    "maxPrice": 2500,
    "minPrice": 2000,
    "maxDistance": 3,
    "minLeaseDuration": 6
  },
  "results": [
    {
      "platform": "RentGuard",
      "platformUrl": "/",
      "properties": [...],
      "totalCount": 10
    },
    {
      "platform": "Zillow",
      "platformUrl": "https://zillow.com",
      "properties": [...],
      "totalCount": 5
    }
  ],
  "message": "已找到 15 个匹配的房源"
}
```

### 房源管理

#### GET `/api/properties`
获取房源列表

**查询参数:**
- `landlordId`: 房东ID（可选）
- `page`: 页码（默认1）
- `limit`: 每页数量（默认20）

#### GET `/api/properties/search`
搜索房源

**查询参数:**
- `city`: 城市
- `state`: 州/省
- `minPrice`: 最低价格
- `maxPrice`: 最高价格
- `minBedrooms`: 最小卧室数
- `minBathrooms`: 最小浴室数
- `petFriendly`: 是否允许宠物（true/false）
- `page`: 页码
- `limit`: 每页数量

#### POST `/api/properties`
创建房源（需要房东权限）

**请求体:**
```json
{
  "title": "Modern Downtown Apartment",
  "description": "Beautiful apartment in downtown",
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
  "images": ["url1", "url2"],
  "amenities": ["parking", "gym"],
  "petFriendly": true,
  "availableFrom": "2024-02-01",
  "leaseDuration": 12
}
```

#### GET `/api/properties/[id]`
获取单个房源详情

#### PATCH `/api/properties/[id]`
更新房源（需要房东权限）

#### DELETE `/api/properties/[id]`
删除房源（需要房东权限）

### 申请管理

#### POST `/api/applications`
创建申请

**请求体:**
```json
{
  "propertyId": "property-id",
  "monthlyIncome": 8500,
  "creditScore": 750,
  "depositAmount": 2800,
  "message": "I'm interested in this property"
}
```

#### GET `/api/applications`
获取申请列表

**查询参数:**
- `userType`: "tenant" 或 "landlord"
- `status`: 申请状态

#### PATCH `/api/applications/[id]`
更新申请状态（房东审核）

**请求体:**
```json
{
  "status": "APPROVED" | "REJECTED" | "UNDER_REVIEW"
}
```

### 押金管理

#### POST `/api/deposits`
创建押金记录（需要年费会员）

**请求体:**
```json
{
  "propertyId": "property-id",
  "amount": 2800,
  "expectedReturn": "2024-12-31"
}
```

#### GET `/api/deposits`
获取押金列表

**查询参数:**
- `status`: 押金状态

#### GET `/api/deposits/[id]`
获取单个押金详情

#### PATCH `/api/deposits/[id]`
退还押金（房东操作）

**请求体:**
```json
{
  "returnAmount": 2800,
  "deductions": {
    "damage": 200,
    "cleaning": 100
  }
}
```

### 会员服务

#### POST `/api/membership/upgrade`
升级为年费会员

**请求体:**
```json
{
  "paymentMethod": "credit_card",
  "transactionId": "txn-123456"
}
```

### 争议解决

#### POST `/api/disputes`
创建争议

**请求体:**
```json
{
  "depositId": "deposit-id",
  "reason": "Dispute reason",
  "claim": "My claim description"
}
```

#### GET `/api/disputes`
获取争议列表

### 需求历史

#### GET `/api/requests/tenant`
获取租客搜索需求历史

#### GET `/api/requests/landlord`
获取房东搜索需求历史

## 数据库模型

主要模型包括：

- **User**: 用户（租客/房东/中介）
- **Property**: 房源
- **TenantRequest**: 租客搜索需求
- **LandlordRequest**: 房东搜索需求
- **Application**: 申请记录
- **Lease**: 租赁合同
- **Deposit**: 押金记录
- **Dispute**: 争议记录
- **Payment**: 支付记录
- **Message**: 消息
- **SavedProperty**: 保存的房源
- **Notification**: 通知

详细模型定义请查看 `prisma/schema.prisma`

## AI功能

### 自然语言解析

系统支持通过自然语言查询提取搜索条件：

**租客示例:**
- "我需要三公里以内的价格2000-2500的房子，长租6个月以上"
- "找西雅图2室1卫，允许宠物的公寓"

**房东示例:**
- "我需要能长租半年以上租金到3000美元的房客"
- "找信用分数700以上，月收入至少5000的租客"

### OpenAI集成（可选）

如果配置了 `OPENAI_API_KEY`，系统会使用OpenAI API进行更准确的自然语言解析。否则使用基于规则的解析。

## 第三方平台集成

### 租房平台（租客端）
- Zillow
- Apartments.com
- Rent.com
- Trulia
- Realtor.com

### 求租平台（房东端）
- 北美小屋
- 一亩三分地
- CSSA论坛

**注意**: 当前实现为模拟数据。实际部署时需要集成真实的第三方API。

## 押金保管服务

年费会员可以享受第三方押金保管服务：

1. 押金由平台托管
2. 租期结束后，房东和租客可以申请退还
3. 如有争议，平台提供公平的争议解决机制
4. 所有操作透明可追溯

## 开发指南

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 打开Prisma Studio查看数据库
pnpm db:studio
```

### 数据库迁移

```bash
# 创建迁移
pnpm db:migrate

# 应用迁移
pnpm db:push
```

## 部署注意事项

1. 确保设置了正确的环境变量
2. 配置生产数据库
3. 设置强密码的JWT_SECRET
4. 配置OpenAI API Key（如使用AI功能）
5. 设置适当的CORS策略
6. 配置HTTPS

## 安全建议

1. 使用强密码策略
2. 实施速率限制
3. 验证所有输入
4. 使用HTTPS
5. 定期更新依赖
6. 实施适当的错误处理

## 许可证

MIT License
