
/**
 * 数据库种子文件 - 用于初始化测试数据
 * 运行: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始种子数据...')

  // 清理现有数据
  try {
    await prisma.message.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.lease.deleteMany()
    await prisma.application.deleteMany()
    await prisma.savedProperty.deleteMany()
    await prisma.property.deleteMany()
    await prisma.tenantProfile.deleteMany()
    await prisma.landlordProfile.deleteMany()
    await prisma.agentProfile.deleteMany()
    await prisma.user.deleteMany()
    console.log('已清理旧数据')
  } catch (error) {
    console.log('清理数据时出错 (可能表不存在):', error)
  }

  // 创建测试用户
  const hashedPassword = await bcrypt.hash('password123', 10)

  // 1. 创建中介 (Agent)
  const agent = await prisma.user.create({
    data: {
      email: 'agent@example.com',
      password: hashedPassword,
      name: 'Michael Agent',
      phone: '+1234567892',
      userType: 'AGENT',
      agentProfile: {
        create: {
          companyName: 'Premium Realty',
          licenseNumber: 'REL-123456',
          verified: true
        }
      }
    }
  })
  console.log('创建中介:', agent.email)

  // 2. 创建房东 (Landlord)
  const landlord = await prisma.user.create({
    data: {
      email: 'landlord@example.com',
      password: hashedPassword,
      name: 'John Landlord',
      phone: '+1234567891',
      userType: 'LANDLORD',
      isPremium: true,
      premiumExpiry: new Date('2025-12-31'),
      landlordProfile: {
        create: {
          companyName: 'Smith Properties',
          verified: true
        }
      }
    }
  })
  console.log('创建房东:', landlord.email)

  // 3. 创建租客 (Tenant)
  const tenant = await prisma.user.create({
    data: {
      email: 'tenant@example.com',
      password: hashedPassword,
      name: 'Sarah Tenant',
      phone: '+1234567890',
      userType: 'TENANT',
      tenantProfile: {
        create: {
          monthlyIncome: 8500,
          creditScore: 750,
          employmentStatus: 'FULL_TIME'
        }
      }
    }
  })
  console.log('创建租客:', tenant.email)

  // 4. 创建房源 (Properties)
  const property1 = await prisma.property.create({
    data: {
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
      agentId: agent.id // Assign to agent
    }
  })

  const propertyLeased = await prisma.property.create({
    data: {
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
      status: 'RENTED', // Already rented
      images: JSON.stringify(['/placeholder.svg?height=200&width=300']),
      amenities: JSON.stringify(['laundry']),
      petFriendly: false,
      availableFrom: new Date('2024-02-15'),
      leaseDuration: 6
    }
  })
  console.log('创建房源:', property1.title, propertyLeased.title)

  // 5. 创建申请 (Application)
  const application = await prisma.application.create({
    data: {
      tenantId: tenant.id,
      propertyId: property1.id,
      status: 'PENDING',
      message: 'I am very interested in this apartment.',
      moveInDate: new Date('2024-03-01'),
      leaseTerm: 12,
      occupants: 1,
      pets: false
    }
  })
  console.log('创建申请:', application.id)

  // 6. 创建租赁合同 (Lease) for the second property
  const lease = await prisma.lease.create({
    data: {
      propertyId: propertyLeased.id,
      tenantId: tenant.id,
      landlordId: landlord.id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rentAmount: 1600,
      depositAmount: 1600,
      status: 'ACTIVE',
      paymentFrequency: 'MONTHLY',
      terms: 'Standard lease terms'
    }
  })
  console.log('创建租赁合同:', lease.id)

  // 7. 创建支付记录 (Payment)
  await prisma.payment.create({
    data: {
      leaseId: lease.id,
      payerId: tenant.id,
      payeeId: landlord.id,
      amount: 1600,
      status: 'COMPLETED',
      type: 'RENT',
      paymentMethod: 'CREDIT_CARD',
      description: 'January Rent',
      paidAt: new Date('2024-01-01')
    }
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
  await prisma.message.create({
    data: {
      senderId: tenant.id,
      receiverId: landlord.id,
      content: 'Is this apartment still available?',
      read: false
    }
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
