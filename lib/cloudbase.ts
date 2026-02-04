// lib/cloudbase.ts
import cloudbase from "@cloudbase/node-sdk";

// 初始化腾讯云连接
// 只有在服务端(API)运行时，才会使用 SecretId/Key
const app = cloudbase.init({
  env: process.env.CLOUDBASE_ENV_ID,
  secretId: process.env.CLOUDBASE_SECRET_ID,
  secretKey: process.env.CLOUDBASE_SECRET_KEY,
});

// 导出数据库操作对象
export const db = app.database();