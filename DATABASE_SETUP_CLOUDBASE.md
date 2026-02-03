# CloudBase 配置指南

## CloudBase 信息

- **环境ID**: `zheng-9g9boofwdf8b9918`
- **地域**: `ap-shanghai` (上海)

## CloudBase 用途

CloudBase 主要用于：
1. **文件存储**: 存储房源图片、文档等
2. **备份服务**: 数据库备份
3. **CDN**: 静态资源加速
4. **云函数**: 额外的业务逻辑（如定时任务）

## 配置步骤

### 1. 获取 CloudBase 密钥

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 进入 **云开发 CloudBase**
3. 选择环境：`zheng-9g9boofwdf8b9918`
4. 进入 **环境设置** > **安全配置**
5. 获取 **SecretId** 和 **SecretKey**

### 2. 配置环境变量

在 `.env` 文件中添加：

```env
CLOUDBASE_ENV_ID="homes-8ghqrqte660fbf1d"
CLOUDBASE_REGION="ap-shanghai"
CLOUDBASE_SECRET_ID="your-secret-id"
CLOUDBASE_SECRET_KEY="your-secret-key"
```

### 3. 安装 CloudBase SDK (可选)

如果需要使用 CloudBase 的文件存储功能：

```bash
npm install @cloudbase/node-sdk
```

### 4. 使用 CloudBase

当前项目主要使用 Supabase 作为主数据库。CloudBase 可以作为：
- 文件存储服务
- 备份数据库
- 云函数服务

## 注意事项

- CloudBase 主要支持 MongoDB 和 MySQL
- 本项目使用 Supabase (PostgreSQL) 作为主数据库
- CloudBase 可用于存储文件和提供其他云服务
