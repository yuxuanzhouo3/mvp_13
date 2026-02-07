/**
 * 诊断脚本：检查 Supabase 配置和连接
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

console.log('=== Supabase 配置检查 ===\n')

// 检查环境变量
const requiredVars = {
  'NEXT_PUBLIC_APP_REGION': process.env.NEXT_PUBLIC_APP_REGION,
  'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'DATABASE_URL': process.env.DATABASE_URL ? '已配置' : '未配置',
  'JWT_SECRET': process.env.JWT_SECRET ? '已配置' : '未配置',
}

console.log('环境变量状态:')
Object.entries(requiredVars).forEach(([key, value]) => {
  const status = value ? '✅' : '❌'
  const displayValue = value 
    ? (key.includes('KEY') || key.includes('SECRET') 
        ? `${value.substring(0, 20)}...` 
        : value)
    : '未配置'
  console.log(`  ${status} ${key}: ${displayValue}`)
})

console.log('\n=== 区域配置 ===')
const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
console.log(`当前区域: ${region}`)
if (region === 'global') {
  console.log('✅ 国际版模式 - 需要使用 Supabase')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('❌ 警告: Supabase 环境变量未配置！')
    console.log('   需要配置:')
    console.log('   - NEXT_PUBLIC_SUPABASE_URL')
    console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.log('   - SUPABASE_SERVICE_ROLE_KEY (推荐)')
  }
} else {
  console.log('✅ 国内版模式 - 使用 CloudBase')
}

// 尝试初始化 Supabase 客户端
if (region === 'global' && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.log('\n=== Supabase 连接测试 ===')
  try {
    const { createClient } = require('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    })
    
    console.log('✅ Supabase 客户端初始化成功')
    console.log(`   URL: ${supabaseUrl}`)
    console.log(`   使用密钥: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key' : 'Anon Key'}`)
    
    // 测试连接（尝试获取用户列表，但可能没有权限）
    console.log('\n提示: 如果登录失败，可能的原因:')
    console.log('1. 用户在 Supabase Auth 中，但密码不正确')
    console.log('2. 用户只在数据库中存在，但不在 Supabase Auth 中')
    console.log('3. Supabase 服务不可用或网络问题')
    console.log('\n建议:')
    console.log('- 检查 Supabase 项目是否正常运行')
    console.log('- 在 Supabase Dashboard 中查看用户是否存在')
    console.log('- 尝试重置密码或重新创建用户')
    
  } catch (error) {
    console.log('❌ Supabase 客户端初始化失败:')
    console.log(`   ${error.message}`)
  }
}

console.log('\n=== 检查完成 ===')
