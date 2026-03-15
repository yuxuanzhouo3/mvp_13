
/**
 * 数据库种子文件 - 用于初始化测试数据
 * 运行: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { getDatabaseAdapter } from '../lib/db-adapter'

const prisma = new PrismaClient()

async function main() {
  console.log('开始种子数据...')
  const db = getDatabaseAdapter()
  const hasTable = async (tableName: string) => {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
        tableName
      ) as any[]
      return Array.isArray(rows) && rows.length > 0
    } catch {
      return false
    }
  }
  const hasColumn = async (tableName: string, columnName: string) => {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND lower(table_name) = lower($1)
           AND lower(column_name) = lower($2)
         LIMIT 1`,
        tableName,
        columnName
      ) as any[]
      return Array.isArray(rows) && rows.length > 0
    } catch {
      return false
    }
  }
  const hasAgentProfileTable = await hasTable('AgentProfile')
  const hasPropertyAgentId = await hasColumn('Property', 'agentId')

  const testEmails = ['agent@example.com', 'landlord@example.com', 'tenant@example.com']
  const testUsers = await prisma.user.findMany({
    where: { email: { in: testEmails } },
    select: { id: true, email: true }
  })
  const testUserIds = testUsers.map((u) => u.id)

  if (testUserIds.length > 0) {
    await prisma.message.deleteMany({
      where: {
        OR: [{ senderId: { in: testUserIds } }, { receiverId: { in: testUserIds } }]
      }
    })
    await prisma.notification.deleteMany({ where: { userId: { in: testUserIds } } })
    await prisma.savedProperty.deleteMany({ where: { userId: { in: testUserIds } } })
    await prisma.payment.deleteMany({
      where: {
        userId: { in: testUserIds }
      }
    })
    await prisma.application.deleteMany({ where: { tenantId: { in: testUserIds } } })
    await prisma.lease.deleteMany({
      where: {
        OR: [{ tenantId: { in: testUserIds } }, { landlordId: { in: testUserIds } }]
      }
    })
    await prisma.property.deleteMany({
      where: {
        landlordId: { in: testUserIds }
      }
    })
  }

  // 创建测试用户
  const hashedPassword = await bcrypt.hash('password123', 10)

  // 1. 创建中介 (Agent)
  const agent = await prisma.user.upsert({
    where: { email: 'agent@example.com' },
    create: {
      email: 'agent@example.com',
      password: hashedPassword,
      name: 'Michael Agent',
      phone: '+1234567892',
      userType: 'AGENT'
    },
    update: {
      password: hashedPassword,
      name: 'Michael Agent',
      phone: '+1234567892',
      userType: 'AGENT'
    }
  })
  if (hasAgentProfileTable) {
    await prisma.agentProfile.upsert({
      where: { userId: agent.id },
      create: {
        userId: agent.id,
        companyName: 'Premium Realty',
        licenseNumber: 'REL-123456',
        verified: true
      },
      update: {
        companyName: 'Premium Realty',
        licenseNumber: 'REL-123456',
        verified: true
      }
    })
  }
  console.log('创建中介:', agent.email)

  // 2. 创建房东 (Landlord)
  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@example.com' },
    create: {
      email: 'landlord@example.com',
      password: hashedPassword,
      name: 'John Landlord',
      phone: '+1234567891',
      userType: 'LANDLORD',
      isPremium: true,
      premiumExpiry: new Date('2025-12-31')
    },
    update: {
      password: hashedPassword,
      name: 'John Landlord',
      phone: '+1234567891',
      userType: 'LANDLORD',
      isPremium: true,
      premiumExpiry: new Date('2025-12-31')
    }
  })
  await prisma.landlordProfile.upsert({
    where: { userId: landlord.id },
    create: {
      userId: landlord.id,
      companyName: 'Smith Properties',
      verified: true
    },
    update: {
      companyName: 'Smith Properties',
      verified: true
    }
  })
  console.log('创建房东:', landlord.email)

  // 3. 创建租客 (Tenant)
  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@example.com' },
    create: {
      email: 'tenant@example.com',
      password: hashedPassword,
      name: 'Sarah Tenant',
      phone: '+1234567890',
      userType: 'TENANT'
    },
    update: {
      password: hashedPassword,
      name: 'Sarah Tenant',
      phone: '+1234567890',
      userType: 'TENANT'
    }
  })
  await prisma.tenantProfile.upsert({
    where: { userId: tenant.id },
    create: {
      userId: tenant.id,
      monthlyIncome: 8500,
      creditScore: 750,
      employmentStatus: 'FULL_TIME'
    },
    update: {
      monthlyIncome: 8500,
      creditScore: 750,
      employmentStatus: 'FULL_TIME'
    }
  })
  console.log('创建租客:', tenant.email)

  // 4. 创建房源 (Properties)
  const existingProperties = await db.query<any>('properties', { landlordId: landlord.id })
  const existingProperty1 = existingProperties.find((p: any) => p.title === 'Modern Downtown Apartment')
  const property1 = existingProperty1 || await db.create<any>('properties', {
    landlordId: landlord.id,
    title: 'Modern Downtown Apartment',
    description: 'Beautiful modern apartment in downtown Seattle with great views',
    address: '123 Main St',
    city: 'Seattle',
    state: 'WA',
    zipCode: '98101',
    country: 'US',
    latitude: 47.6062,
    longitude: -122.3321,
    price: 2800,
    deposit: 2800,
    bedrooms: 2,
    bathrooms: 2,
    sqft: 1200,
    propertyType: 'APARTMENT',
    status: 'AVAILABLE',
    images: JSON.stringify(['/placeholder.svg?height=200&width=300']),
    amenities: JSON.stringify(['parking', 'gym', 'laundry']),
    petFriendly: true,
    availableFrom: new Date('2024-02-01'),
    leaseDuration: 12,
    ...(hasPropertyAgentId ? { agentId: agent.id } : {})
  })

  const existingPropertyLeased = existingProperties.find((p: any) => p.title === 'Cozy Studio in Capitol Hill')
  const propertyLeased = existingPropertyLeased || await db.create<any>('properties', {
    landlordId: landlord.id,
    title: 'Cozy Studio in Capitol Hill',
    description: 'Cozy studio apartment in vibrant Capitol Hill neighborhood',
    address: '456 Pine St',
    city: 'Seattle',
    state: 'WA',
    zipCode: '98102',
    country: 'US',
    latitude: 47.6205,
    longitude: -122.3214,
    price: 1600,
    deposit: 1600,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 650,
    propertyType: 'STUDIO',
    status: 'RENTED',
    images: JSON.stringify(['/placeholder.svg?height=200&width=300']),
    amenities: JSON.stringify(['laundry']),
    petFriendly: false,
    availableFrom: new Date('2024-02-15'),
    leaseDuration: 6
  })
  console.log('创建房源:', property1.title, propertyLeased.title)

  // 5. 创建申请 (Application)
  const application = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      status: 'PENDING',
      monthlyIncome: 8500,
      creditScore: 750,
      depositAmount: 2800,
      message: 'I am very interested in this apartment.',
      appliedDate: new Date('2024-02-20')
    }
  })
  console.log('创建申请:', application.id)

  // 6. 创建租赁合同 (Lease) for the second property
  const hasLeaseMonthlyRent = await hasColumn('Lease', 'monthlyRent')
  const hasLeaseRentAmount = await hasColumn('Lease', 'rentAmount')
  const hasLeasePaymentFrequency = await hasColumn('Lease', 'paymentFrequency')
  const hasLeaseTerms = await hasColumn('Lease', 'terms')
  const lease = await db.create<any>('leases', {
    propertyId: propertyLeased.id,
    tenantId: tenant.id,
    landlordId: landlord.id,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    ...(hasLeaseMonthlyRent ? { monthlyRent: 1600 } : {}),
    ...(hasLeaseRentAmount ? { rentAmount: 1600 } : {}),
    depositAmount: 1600,
    ...(hasLeasePaymentFrequency ? { paymentFrequency: 'MONTHLY' } : {}),
    ...(hasLeaseTerms ? { terms: 'Standard lease terms' } : {}),
    status: 'ACTIVE'
  })
  console.log('创建租赁合同:', lease.id)

  // 7. 创建支付记录 (Payment)
  await db.create('payments', {
    userId: tenant.id,
    propertyId: propertyLeased.id,
    amount: 1600,
    status: 'COMPLETED',
    type: 'RENT',
    paymentMethod: 'CREDIT_CARD',
    description: 'January Rent'
  })
  console.log('创建支付记录')

  // 8. 创建收藏 (Saved Property)
  await prisma.savedProperty.create({
    data: {
      userId: tenant.id,
      propertyId: property1.id
    }
  })
  console.log('创建收藏')

  // 9. 创建消息 (Message)
  const hasMessageIsRead = await hasColumn('Message', 'isRead')
  await db.create('messages', {
    senderId: tenant.id,
    receiverId: landlord.id,
    content: 'Is this apartment still available?',
    ...(hasMessageIsRead ? { isRead: false } : {})
  })
  console.log('创建消息')

  console.log('种子数据创建完成!')
  console.log('-----------------------------------')
  console.log('请使用以下账号登录测试:')
  console.log('房东: landlord@example.com / password123')
  console.log('租客: tenant@example.com / password123')
  console.log('中介: agent@example.com / password123')
  console.log('-----------------------------------')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
