# .env 文件完整内容

如果 `.env` 文件创建失败，请手动创建并复制以下内容：

```env
# Database Configuration
# Supabase PostgreSQL (Primary Database)
DATABASE_URL="postgresql://postgres:RDdoFMFmSTVCQP4r@db.dhtfuyddjteoqduzvoqw.supabase.co:5432/postgres"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://dhtfuyddjteoqduzvoqw.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRodGZ1eWRkanRlb3FkdXp2b3F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzYzMzEsImV4cCI6MjA4NTY1MjMzMX0.RdhnPZPQNcHGi9jkZPQtPTN_SjJkrZ7NDJgMRP0Tlpk"
SUPABASE_SERVICE_ROLE_KEY=""

# CloudBase Configuration (Tencent Cloud)
CLOUDBASE_ENV_ID="homes-8ghqrqte660fbf1d"
CLOUDBASE_REGION="ap-shanghai"
CLOUDBASE_SECRET_ID=""
CLOUDBASE_SECRET_KEY=""

# JWT Secret (Change this in production!)
JWT_SECRET="rentguard-super-secret-jwt-key-2024-change-in-production"

# Mistral AI Configuration
MISTRAL_API_KEY="2eiKa3bWBxk102u1PnDwdskHPI8M2mvh"
MISTRAL_MODEL="mistral-large-latest"

# Node Environment
NODE_ENV="development"
```

## 下一步操作

1. **确认 .env 文件已创建**
   - 检查项目根目录是否有 `.env` 文件
   - 如果没有，请手动创建并复制上面的内容

2. **获取 Supabase Service Role Key（可选但推荐）**
   - 访问：https://supabase.com/dashboard
   - 进入项目：`dhtfuyddjteoqduzvoqw`
   - 进入 **Settings** > **API**
   - 复制 **service_role** key
   - 替换 `.env` 文件中的 `SUPABASE_SERVICE_ROLE_KEY=""`

3. **创建数据库表**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **验证连接**
   ```bash
   npm run db:studio
   ```

## 注意事项

- ⚠️ `.env` 文件包含敏感信息，不要提交到 Git
- ✅ `.env` 文件已在 `.gitignore` 中，不会被提交
- 🔒 生产环境请更改 `JWT_SECRET` 为更安全的随机字符串
