# RentGuard 后端快速开始指南

## 安装步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件（参考 `.env.example`）：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/rentguard?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
OPENAI_API_KEY="sk-your-openai-api-key"  # 可选
```

### 3. 设置数据库

```bash
# 生成Prisma客户端
pnpm db:generate

# 推送数据库schema（开发环境）
pnpm db:push

# 或使用迁移（生产环境推荐）
pnpm db:migrate

# 填充测试数据（可选）
pnpm db:seed
```

### 4. 启动开发服务器

```bash
pnpm dev
```

服务器将在 http://localhost:3000 启动

## 测试API

### 1. 注册用户

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "userType": "TENANT"
  }'
```

### 2. 登录获取Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. 使用AI对话搜索（需要Token）

```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "我需要三公里以内的价格2000-2500的房子，长租6个月以上",
    "userType": "TENANT"
  }'
```

## 主要功能

### ✅ 已实现的功能

1. **用户认证**
   - 注册/登录
   - JWT Token认证
   - 用户类型（租客/房东/中介）

2. **AI对话搜索**
   - 自然语言查询解析
   - 租客搜索房源
   - 房东搜索租客
   - 支持OpenAI API（可选）

3. **房源管理**
   - CRUD操作
   - 搜索和筛选
   - 地理位置支持

4. **申请管理**
   - 租客申请房源
   - 房东审核申请
   - 申请状态跟踪

5. **押金保管服务**
   - 年费会员功能
   - 押金托管
   - 退还管理
   - 争议解决

6. **会员系统**
   - 年费会员升级
   - 会员权限管理

7. **数据持久化**
   - 搜索需求入库
   - 完整的数据库模型

## 数据库模型

主要表结构：

- `User` - 用户表
- `Property` - 房源表
- `TenantRequest` - 租客搜索需求
- `LandlordRequest` - 房东搜索需求
- `Application` - 申请记录
- `Deposit` - 押金记录
- `Dispute` - 争议记录
- `Payment` - 支付记录
- `Message` - 消息
- `SavedProperty` - 保存的房源

## 下一步

1. 集成真实的第三方API（Zillow、Apartments.com等）
2. 实现支付网关集成
3. 添加消息通知系统
4. 实现文件上传功能
5. 添加单元测试和集成测试

## 注意事项

- 当前第三方搜索为模拟数据，需要集成真实API
- OpenAI API为可选功能，未配置时使用规则匹配
- 生产环境请使用强密码和HTTPS
- 建议实施速率限制和输入验证

## 获取帮助

查看完整API文档：`README_BACKEND.md`
