/**
 * 数据迁移脚本：为现有用户设置默认配额
 * 
 * 使用方法：
 * npx tsx prisma/migrate-quota.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始迁移用户配额数据...')

  // 获取所有用户
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { vipLevel: null },
        { dailyQuota: null },
        { monthlyQuota: null },
      ],
    },
  })

  console.log(`找到 ${users.length} 个需要更新的用户`)

  let updated = 0

  for (const user of users) {
    // 根据 isPremium 设置 vipLevel
    const vipLevel = user.isPremium ? 'PREMIUM' : 'FREE'
    
    // 设置配额
    const dailyQuota = user.isPremium ? 200 : 10
    const monthlyQuota = user.isPremium ? 2000 : 100

    // 更新用户
    await prisma.user.update({
      where: { id: user.id },
      data: {
        vipLevel: vipLevel,
        subscriptionEndTime: user.premiumExpiry,
        dailyQuota: dailyQuota,
        monthlyQuota: monthlyQuota,
        // lastUsageDate 保持为 null，首次使用时自动设置
      },
    })

    updated++
    console.log(`已更新用户 ${user.email} (${user.id})`)
  }

  console.log(`\n迁移完成！共更新 ${updated} 个用户`)
}

main()
  .catch((e) => {
    console.error('迁移失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
