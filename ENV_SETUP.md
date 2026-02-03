# 环境变量配置说明

## 需要添加的 Mistral API 配置

请在项目根目录的 `.env` 文件中添加以下内容：

```env
MISTRAL_API_KEY=2eiKa3bWBxk102u1PnDwdskHPI8M2mvh
MISTRAL_MODEL=mistral-large-latest
```

## 手动配置步骤

1. 在项目根目录找到 `.env` 文件（如果不存在，请创建它）

2. 添加以下两行：

```
MISTRAL_API_KEY=2eiKa3bWBxk102u1PnDwdskHPI8M2mvh
MISTRAL_MODEL=mistral-large-latest
```

3. 保存文件

4. 重启开发服务器：

```bash
npm run dev
```

## 验证配置

配置完成后，AI 功能将使用 Mistral API 进行自然语言解析。

## 注意事项

- `.env` 文件已添加到 `.gitignore`，不会被提交到代码仓库
- 请确保 API Key 正确，否则 AI 功能将回退到规则匹配模式
