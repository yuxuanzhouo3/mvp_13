# 支付宝沙盒支付集成配置说明

## 一、环境变量配置

在项目根目录的 `.env.local` 文件中添加以下配置：

```env
# 支付宝沙盒配置
ALIPAY_APP_ID=9021000161601994
ALIPAY_PRIVATE_KEY=你的应用私钥（完整内容，包含-----BEGIN RSA PRIVATE KEY-----和-----END RSA PRIVATE KEY-----）
ALIPAY_PUBLIC_KEY=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwKo0Yi8ZRb7Hgxo9Xb6A7GnfzjOt4XhBdXhqaLskRa/la1OQVd0m7aF8J2wrIximkxYglg5LTWC0quI2wr8wCUm8f/qCjRIn0NJFxBsY+ZiREQWQyILwiUiV8tYt+J114RYm2y0CiR+3BNUZcppoqj0u7Fru0XY+Wedn+krvmyqFZw7JKqXWeLZL1B11A8i/4XzcBDIFxm67Kwvr1Qr5UF6VEQSkIKRjF57PKWqGfZe+DmhD7PmBVsUo3mbueEJLs7qABkVLi0y3ebkRNVcBv0LW7jFaWmrR8dUSppc/HvDMLaNj6Cnt6T38cRZxQ5YZzYHE05EfYIEdbusto0cDmwIDAQAB
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do

# 应用URL（使用cpolar内网穿透地址）
NEXT_PUBLIC_APP_URL=https://7b17d9a0.r27.cpolar.top

# 应用区域
NEXT_PUBLIC_APP_REGION=china
```

## 二、支付宝沙盒信息

根据您提供的信息：

- **APPID**: 9021000161601994
- **应用名称**: sandbox
- **默认应用**: 2088721095885438
- **绑定的商家账号（PID）**: 2088721095885438
- **支付宝网关地址**: https://openapi-sandbox.dl.alipaydev.com/gateway.do
- **服务地址**: openchannel-sandbox.dl.alipaydev.com
- **应用公钥**: MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3pElk/g/2n3tizwDX36hHziMSVKqqWRlQQDqf3aZNCTU769Zr2oYy4iQIU5iuxh9UposmO47Ue9sMwZCow2yiYMiL1Jer3iUoB/1tAhUptt4K3SQ1DQBoTqJRaXD4ss7TV503mvE6sWDcKxfR+pSCpM4r6GduS445Yn1lbvXtX560CWPwfqwZkrYIHvuT30dwZMBUnqR6C0XYuB+LA9TjDM5k5E/JsDGzF+IsaFCVwULo8DaFkEmZnGtNC23iRRNSpZrSdNZTryBdg2l3Vww7KAAycFtUT1gScBP5NbPthE9DHUpHKyWZPR6c7Fup9exL5SMaaNJvlbbHWO/xD+QyQIDAQAB
- **支付宝公钥**: MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwKo0Yi8ZRb7Hgxo9Xb6A7GnfzjOt4XhBdXhqaLskRa/la1OQVd0m7aF8J2wrIximkxYglg5LTWC0quI2wr8wCUm8f/qCjRIn0NJFxBsY+ZiREQWQyILwiUiV8tYt+J114RYm2y0CiR+3BNUZcppoqj0u7Fru0XY+Wedn+krvmyqFZw7JKqXWeLZL1B11A8i/4XzcBDIFxm67Kwvr1Qr5UF6VEQSkIKRjF57PKWqGfZe+DmhD7PmBVsUo3mbueEJLs7qABkVLi0y3ebkRNVcBv0LW7jFaWmrR8dUSppc/HvDMLaNj6Cnt6T38cRZxQ5YZzYHE05EfYIEdbusto0cDmwIDAQAB

## 三、需要完成的步骤

### 1. 获取应用私钥

您需要从支付宝开放平台获取应用私钥。私钥格式应该类似：

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
（私钥内容）
...
-----END RSA PRIVATE KEY-----
```

**重要**: 将完整的私钥（包括头尾）复制到 `.env.local` 文件的 `ALIPAY_PRIVATE_KEY` 中。

### 2. 配置内网穿透（cpolar）

1. 确保 cpolar 正在运行
2. 确认转发地址：`https://7b17d9a0.r27.cpolar.top -> http://localhost:3000`
3. 如果地址变化，更新 `.env.local` 中的 `NEXT_PUBLIC_APP_URL`

### 3. 配置支付宝回调地址

在支付宝开放平台（沙盒环境）中配置：

- **异步通知地址（notify_url）**: `https://7b17d9a0.r27.cpolar.top/api/payments/alipay/notify`
- **同步返回地址（return_url）**: `https://7b17d9a0.r27.cpolar.top/api/payments/alipay/return`

### 4. 安装依赖

已自动安装 `alipay-sdk`，如果未安装，运行：

```bash
npm install alipay-sdk
```

### 5. 重启开发服务器

配置完成后，重启开发服务器：

```bash
npm run dev
```

## 四、测试流程

1. **创建支付订单**：
   - 以租客身份登录
   - 在支付页面点击"立即支付"
   - 选择"支付宝"

2. **跳转到支付宝沙盒**：
   - 系统会跳转到支付宝沙盒支付页面
   - 使用支付宝沙盒账号登录并支付

3. **支付完成**：
   - 支付成功后，支付宝会重定向回应用
   - 系统会自动更新支付状态

4. **查看支付记录**：
   - 在支付历史页面查看支付状态
   - 状态应显示为"已完成"

## 五、常见问题

### 1. 签名验证失败

- 检查 `ALIPAY_PRIVATE_KEY` 和 `ALIPAY_PUBLIC_KEY` 是否正确配置
- 确保私钥格式正确（包含头尾）

### 2. 回调地址无法访问

- 确保 cpolar 正在运行
- 检查 `NEXT_PUBLIC_APP_URL` 是否与 cpolar 地址一致
- 确保防火墙允许访问

### 3. 支付金额错误

- 检查数据库中金额单位（元还是分）
- 代码会自动处理金额转换

## 六、文件说明

- `lib/payment-service.ts`: 支付服务核心逻辑
- `app/api/payments/[id]/initiate/route.ts`: 支付初始化API
- `app/api/payments/alipay/notify/route.ts`: 支付宝异步通知接口
- `app/api/payments/alipay/return/route.ts`: 支付宝同步返回接口
- `components/dashboard/payment-method-dialog.tsx`: 支付方式选择对话框
- `components/dashboard/payment-history.tsx`: 支付历史组件（已更新）

## 七、注意事项

1. **沙盒环境**：当前配置为支付宝沙盒环境，仅用于测试
2. **内网穿透**：cpolar 地址可能会变化，需要及时更新
3. **安全性**：生产环境请使用正式环境配置，并妥善保管私钥
4. **金额单位**：确保金额单位一致（代码已处理自动转换）
