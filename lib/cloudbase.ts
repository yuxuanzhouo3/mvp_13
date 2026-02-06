// lib/cloudbase.ts
import cloudbase from "@cloudbase/node-sdk";

// 打印调试日志，看看云端到底读到了什么
const envId = "homes-8ghqrqte660fbf1d"; // 🔥 直接写死，防止读不到变量
const secretId = process.env.CLOUDBASE_SECRET_ID || "";
const secretKey = process.env.CLOUDBASE_SECRET_KEY || "";

console.log("正在初始化 CloudBase...");
console.log("Target Env ID:", envId);
console.log("Secret ID length:", secretId.length); // 不要打印明文，只打印长度检查是否存在
console.log("Secret Key length:", secretKey.length);

// 初始化腾讯云连接
const app = cloudbase.init({
  // 核心修复：直接使用字符串，确保连对环境
  env: envId,
  
  // 密钥继续尝试读取变量
  // 如果部署后日志显示 Secret ID length 为 0，说明变量没填对
  secretId: secretId,
  secretKey: secretKey,
});

// 导出数据库操作对象
export const db = app.database();