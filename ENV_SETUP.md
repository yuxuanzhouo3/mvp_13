# 环境变量配置说明

## 支付宝支付配置

在项目根目录创建 `.env.local` 文件（如果不存在），并添加以下配置：

```env
# 支付宝沙盒配置
ALIPAY_APP_ID=9021000161601994
ALIPAY_PRIVATE_KEY=你的应用私钥（完整内容）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwKo0Yi8ZRb7Hgxo9Xb6A7GnfzjOt4XhBdXhqaLskRa/la1OQVd0m7aF8J2wrIximkxYglg5LTWC0quI2wr8wCUm8f/qCjRIn0NJFxBsY+ZiREQWQyILwiUiV8tYt+J114RYm2y0CiR+3BNUZcppoqj0u7Fru0XY+Wedn+krvmyqFZw7JKqXWeLZL1B11A8i/4XzcBDIFxm67Kwvr1Qr5UF6VEQSkIKRjF57PKWqGfZe+DmhD7PmBVsUo3mbueEJLs7qABkVLi0y3ebkRNVcBv0LW7jFaWmrR8dUSppc/HvDMLaNj6Cnt6T38cRZxQ5YZzYHE05EfYIEdbusto0cDmwIDAQAB
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do

# 应用URL（使用cpolar内网穿透地址）
NEXT_PUBLIC_APP_URL=https://7b17d9a0.r27.cpolar.top

# 应用区域
NEXT_PUBLIC_APP_REGION=china
```

## 重要提示

### 1. 私钥配置格式

`ALIPAY_PRIVATE_KEY` 可以有两种格式：

**方式一：包含PEM头尾（推荐）**
```env
ALIPAY_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
（私钥内容）
...
-----END RSA PRIVATE KEY-----"
```

**方式二：仅私钥内容（会自动添加头尾）**
```env
ALIPAY_PRIVATE_KEY=MIIEpAIBAAKCAQEA...（完整的私钥内容，不包含头尾）
```

### 2. 获取应用私钥

1. 登录 [支付宝开放平台](https://open.alipay.com/)
2. 进入"控制台" -> "网页&移动应用" -> 选择您的应用
3. 在"接口加签方式"中查看或生成应用私钥
4. 复制完整的私钥内容到 `.env.local` 文件

### 3. 验证配置

配置完成后，**必须重启开发服务器**才能生效：

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

### 4. 常见问题

**问题：显示 "Alipay private key is not configured"**

解决方案：
1. 检查 `.env.local` 文件是否存在
2. 确认 `ALIPAY_PRIVATE_KEY` 已正确设置
3. 确认私钥内容完整（没有截断）
4. 重启开发服务器

**问题：私钥格式错误**

解决方案：
- 确保私钥是完整的RSA私钥
- 如果包含PEM头尾，确保格式正确
- 如果不包含头尾，代码会自动添加

### 5. 文件位置

确保 `.env.local` 文件位于项目根目录，与 `package.json` 同级：

```
项目根目录/
├── .env.local          ← 在这里
├── package.json
├── next.config.js
└── ...
```

### 6. 安全提示

- ⚠️ `.env.local` 文件包含敏感信息，**不要提交到Git仓库**
- ⚠️ 确保 `.env.local` 已在 `.gitignore` 中
- ⚠️ 生产环境请使用环境变量管理服务（如Vercel的环境变量）
