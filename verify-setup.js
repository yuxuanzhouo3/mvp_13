// 验证设置脚本
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function verify() {
  try {
    console.log('✅ 正在验证数据库连接...')
    
    // 测试连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功')
    
    // 测试查询
    const userCount = await prisma.user.count()
    console.log(`✅ 数据库查询成功，当前用户数: ${userCount}`)
    
    console.log('\n✅ 所有验证通过！可以开始使用系统了。')
  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verify()
