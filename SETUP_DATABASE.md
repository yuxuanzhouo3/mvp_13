# 数据库连接配置完成 ✅

## 已完成的配置

1. ✅ 修改 Prisma Schema 从 SQLite 改为 PostgreSQL
2. ✅ 配置 Supabase 连接
3. ✅ 配置 CloudBase 连接
4. ✅ 更新数据类型（JSON 字段）
5. ✅ 创建环境变量配置文件

## 下一步操作

### 1. 获取 Supabase 数据库密码

1. 访问：https://supabase.com/dashboard
2. 选择项目：`ganektphyohnyweamevs`
3. 进入 **Settings** > **Database**
4. 找到 **Connection string**，复制密码部分
5. 更新 `.env` 文件中的 `DATABASE_URL`

### 2. 更新 .env 文件

编辑 `.env` 文件，替换以下内容：

```env
# Supabase PostgreSQL 数据库连接
DATABASE_URL="postgresql://postgres:RDdoFMFmSTVCQP4r@db.dhtfuyddjteoqduzvoqw.supabase.co:5432/postgres"

# 从 Supabase Dashboard > Settings > API 获取
SUPABASE_SERVICE_ROLE_KEY=""
```

### 3. 创建数据库表

运行以下命令创建所有表：

```bash
# 生成 Prisma Client
npm run db:generate

# 推送 schema 到 Supabase（创建表）
npm run db:push
```

### 4. 验证连接

```bash
# 打开 Prisma Studio 查看数据库
npm run db:studio
```

## 数据库架构

项目使用 **Supabase (PostgreSQL)** 作为主数据库，包含以下表：

1. **User** - 用户表
2. **TenantProfile** - 租客资料
3. **LandlordProfile** - 房东资料
4. **Property** - 房源表
5. **TenantRequest** - 租客求租需求
6. **LandlordRequest** - 房东求租客需求
7. **Application** - 申请记录
8. **Lease** - 租赁合同
9. **Deposit** - 押金记录
10. **Dispute** - 争议记录
11. **Payment** - 支付记录
12. **Message** - 消息表
13. **SavedProperty** - 保存的房源
14. **Notification** - 通知表

## CloudBase 配置

CloudBase 主要用于文件存储和备份服务。如需使用，请：

1. 获取 CloudBase SecretId 和 SecretKey
2. 更新 `.env` 文件中的 CloudBase 配置
3. 安装 CloudBase SDK（如需要）

## 故障排除

### 问题：连接失败

**检查**：
1. 确认 `DATABASE_URL` 中的密码正确
2. 确认 Supabase 项目状态正常
3. 检查网络连接

### 问题：表已存在错误

**解决**：
```bash
# 如果表已存在，使用 migrate 而不是 push
npm run db:migrate
```

### 问题：JSON 字段错误

**说明**：已更新 schema 使用 PostgreSQL 的 JSON 类型，不再使用字符串

## 详细文档

- `DATABASE_SETUP_SUPABASE.md` - Supabase 详细配置
- `DATABASE_SETUP_CLOUDBASE.md` - CloudBase 详细配置

现在可以开始使用数据库了！🚀
