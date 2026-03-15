/**
 * 数据库连接测试脚本
 * 用于诊断数据库连接问题
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  console.log('=== 数据库连接测试 ===\n')
  
  // 1. 检查环境变量
  const databaseUrl = process.env.DATABASE_URL
  console.log('1. 环境变量检查:')
  if (!databaseUrl) {
    console.error('   ❌ DATABASE_URL 未配置')
    console.error('   请在 .env 或 .env.local 文件中配置 DATABASE_URL')
    process.exit(1)
  }
  
  // 隐藏密码显示
  const urlObj = new URL(databaseUrl)
  const safeUrl = `${urlObj.protocol}//${urlObj.username}:***@${urlObj.host}${urlObj.pathname}${urlObj.search}`
  console.log(`   ✅ DATABASE_URL 已配置`)
  console.log(`   连接字符串: ${safeUrl}`)
  console.log(`   主机: ${urlObj.host}`)
  console.log(`   数据库: ${urlObj.pathname}`)
  console.log(`   端口: ${urlObj.port || '默认'}`)
  
  // 2. 检查是否是 Supabase
  const isSupabase = databaseUrl.includes('supabase.co')
  console.log(`\n2. 数据库类型:`)
  console.log(`   ${isSupabase ? '✅ Supabase' : '❌ 非 Supabase'}`)
  
  if (isSupabase) {
    const isPooler = databaseUrl.includes(':6543')
    console.log(`   连接方式: ${isPooler ? '连接池 (端口 6543)' : '直接连接 (端口 5432)'}`)
    if (!isPooler) {
      console.log(`   ⚠️  建议使用连接池 URL (端口 6543) 以获得更好的性能`)
      console.log(`   在 Supabase Dashboard → Settings → Database → Connection pooling 获取`)
    }
  }
  
  // 3. 测试 Prisma 连接
  console.log(`\n3. Prisma 连接测试:`)
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  })
  
  try {
    console.log('   正在连接...')
    await prisma.$connect()
    console.log('   ✅ Prisma 连接成功')
    
    // 4. 测试简单查询
    console.log(`\n4. 数据库查询测试:`)
    try {
      const userCount = await prisma.user.count()
      console.log(`   ✅ 查询成功`)
      console.log(`   用户数量: ${userCount}`)
      
      // 测试查找用户
      if (userCount > 0) {
        const firstUser = await prisma.user.findFirst({
          select: {
            id: true,
            email: true,
            name: true,
            userType: true,
          }
        })
        console.log(`   示例用户:`, firstUser)
      }
    } catch (queryError) {
      console.error(`   ❌ 查询失败:`, queryError.message)
      console.error(`   错误详情:`, queryError)
    }
    
    // 5. 测试连接池状态
    if (isSupabase) {
      console.log(`\n5. Supabase 连接状态:`)
      try {
        // 尝试获取数据库版本
        const result = await prisma.$queryRaw`SELECT version()`
        console.log(`   ✅ 可以执行 SQL 查询`)
        if (result && result[0]) {
          const version = result[0].version || ''
          console.log(`   数据库版本: ${version.substring(0, 50)}...`)
        }
      } catch (versionError) {
        console.warn(`   ⚠️  无法获取数据库版本:`, versionError.message)
      }
    }
    
    await prisma.$disconnect()
    console.log(`\n✅ 所有测试通过！数据库连接正常。`)
    
  } catch (error) {
    console.error(`   ❌ Prisma 连接失败`)
    console.error(`   错误消息: ${error.message}`)
    console.error(`   错误代码: ${error.code || 'N/A'}`)
    
    const errorMsg = String(error.message || '').toLowerCase()
    
    // 诊断常见问题
    console.log(`\n6. 问题诊断:`)
    
    if (errorMsg.includes("can't reach") || errorMsg.includes('connection')) {
      console.log(`   ❌ 网络连接问题`)
      console.log(`   可能原因:`)
      console.log(`   1. 数据库服务器不可访问`)
      console.log(`   2. 网络防火墙阻止了连接`)
      console.log(`   3. DATABASE_URL 中的主机地址错误`)
      console.log(`   解决方案:`)
      console.log(`   - 检查 DATABASE_URL 中的主机地址是否正确`)
      console.log(`   - 检查网络连接`)
      console.log(`   - 如果使用 Supabase，检查项目状态`)
    }
    
    if (errorMsg.includes('authentication') || errorMsg.includes('password')) {
      console.log(`   ❌ 认证失败`)
      console.log(`   可能原因:`)
      console.log(`   1. 用户名或密码错误`)
      console.log(`   2. 密码中的特殊字符未正确编码`)
      console.log(`   解决方案:`)
      console.log(`   - 检查 DATABASE_URL 中的用户名和密码`)
      console.log(`   - 如果密码包含特殊字符，需要进行 URL 编码`)
      console.log(`   - 在 Supabase Dashboard 中重置数据库密码`)
    }
    
    if (errorMsg.includes('maxclients') || errorMsg.includes('too many')) {
      console.log(`   ❌ 连接池已满`)
      console.log(`   解决方案:`)
      console.log(`   - 使用连接池 URL (端口 6543)`)
      console.log(`   - 等待一段时间后重试`)
      console.log(`   - 检查是否有其他应用在使用连接`)
    }
    
    if (errorMsg.includes('database') && errorMsg.includes('not exist')) {
      console.log(`   ❌ 数据库不存在`)
      console.log(`   解决方案:`)
      console.log(`   - 检查 DATABASE_URL 中的数据库名称`)
      console.log(`   - Supabase 默认数据库名是 'postgres'`)
    }
    
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  }
}

testConnection().catch((error) => {
  console.error('测试脚本执行失败:', error)
  process.exit(1)
})
