/**
 * 数据库种子文件 - 用于初始化测试数据
 * 运行: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始种子数据...')

  // 创建测试用户
  const hashedPassword = await bcrypt.hash('password123', 10)

  // 创建租客
  const tenant = await prisma.user.upsert({
    where: { email: 'tenant@example.com' },
    update: {},
    create: {
      email: 'tenant@example.com',
      password: hashedPassword,
      name: 'Sarah Johnson',
      phone: '+1234567890',
      userType: 'TENANT' as any,
      tenantProfile: {
        create: {
          monthlyIncome: 8500,
          creditScore: 750,
          employmentStatus: 'FULL_TIME'
        }
      }
    }
  })

  // 创建房东
  const landlord = await prisma.user.upsert({
    where: { email: 'landlord@example.com' },
    update: {},
    create: {
      email: 'landlord@example.com',
      password: hashedPassword,
      name: 'John Smith',
      phone: '+1234567891',
      userType: 'LANDLORD' as any,
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

  // 创建测试房源
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
      propertyType: 'APARTMENT' as any,
      status: 'AVAILABLE' as any,
      images: JSON.stringify(['/placeholder.svg?height=200&width=300']),
      amenities: JSON.stringify(['parking', 'gym', 'laundry']),
      petFriendly: true,
      availableFrom: new Date('2024-02-01'),
      leaseDuration: 12
    }
  })

  const property2 = await prisma.property.create({
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
      propertyType: 'STUDIO' as any,
      status: 'AVAILABLE' as any,
      images: JSON.stringify(['/placeholder.svg?height=200&width=300']),
      amenities: JSON.stringify(['laundry']),
      petFriendly: false,
      availableFrom: new Date('2024-02-15'),
      leaseDuration: 6
    }
  })

  console.log('种子数据创建完成!')
  console.log('租客:', tenant.email)
  console.log('房东:', landlord.email)
  console.log('房源1:', property1.title)
  console.log('房源2:', property2.title)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
