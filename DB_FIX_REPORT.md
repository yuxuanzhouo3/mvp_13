# 国际版数据库连接问题诊断与修复报告

## 诊断结果
经过详细的测试和诊断，我们发现国际版 (Supabase) 数据库存在以下严重问题，导致无法连接：

1.  **连接池耗尽 (Connection Pool Exhausted)**:
    *   尝试通过 Pooler (端口 6543) 连接时，报错 `FATAL: Unable to check out connection from the pool due to timeout`。
    *   这表明数据库的连接池已满或被死锁，无法接受新的查询请求。

2.  **直接连接不可达 (Direct Connection Unreachable)**:
    *   尝试通过 Direct URL (端口 5432) 连接时，报错 `Can't reach database server` 或 `DNS ENOTFOUND`。
    *   这可能是由于网络环境原因（国内网络连接 Supabase 不稳定）或数据库实例本身无响应。

3.  **服务角色权限丢失 (Service Role Permissions Lost)**:
    *   尝试通过 Supabase Data API (PostgREST) 访问数据时，报错 `permission denied for schema public`。
    *   这意味着即使 API 是通的，`service_role`（最高权限角色）也失去了对 `public` 模式下表（如 `User`, `Property`）的访问权限。这通常是异常情况。

## 已进行的修复尝试
1.  **代码优化**:
    *   修改了 `lib/db.ts`，移除了强制 `connection_limit=1` 的限制，允许 `.env` 配置生效。
    *   创建了 `scripts/test-db-connection.ts` 和 `scripts/fix-db-permissions.ts` 用于诊断和尝试自动修复权限。
2.  **自动修复失败**:
    *   尝试运行 SQL 脚本重新授予 `service_role` 权限，但由于数据库连接池耗尽（超时），SQL 无法执行。

## 建议的解决方案 (需要用户操作)
由于数据库处于“僵死”状态且我没有 Supabase Dashboard 的访问权限，需要你手动执行以下操作：

1.  **重启 Supabase 数据库**:
    *   登录 Supabase Dashboard。
    *   进入 Project Settings -> Database -> Restart Database。
    *   这通常能清除卡住的连接并恢复 Pooler 的正常工作。

2.  **运行权限修复脚本 (重启后)**:
    *   数据库重启成功后，请在终端运行以下命令，修复可能丢失的权限：
        ```bash
        npx tsx scripts/fix-db-permissions.ts
        ```

3.  **检查网络**:
    *   确保你的开发环境能够访问 Supabase 的端口 6543 和 5432。如果是在国内环境，建议开启 VPN 或使用代理。

## 代码变更
我已优化了 `lib/db.ts` 中的连接配置逻辑，并准备了修复脚本。一旦数据库重启，系统应能自动恢复正常。
