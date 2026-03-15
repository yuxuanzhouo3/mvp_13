import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseAdapter, getAppRegion } from '@/lib/db-adapter'
import { PrismaClient } from '@prisma/client'

// Use a global prisma instance if available, or create a new one
const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // In a real app, we would verify the token here.
    // For now, we assume the token is valid if present, but we should ideally decode it to get the current user ID.
    // However, the query params usually provide the context (e.g. agentId).

    const { searchParams } = new URL(request.url)
    const userType = searchParams.get('userType')
    const agentId = searchParams.get('agentId')
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const region = getAppRegion()
    const db = getDatabaseAdapter()

    if (region === 'china') {
      // CloudBase implementation
      const filters: any = {}
      if (userType) filters.userType = userType
      
      // Note: CloudBase adapter might not support deep filtering on related collections easily
      // So we might need to fetch users and filter in memory if agentId is provided
      
      let users = await db.query('users', filters)

      // Filter by agentId if provided (this assumes some way to link users to agents in CloudBase)
      // In the schema, TenantProfile and LandlordProfile have representedById.
      // CloudBase might store this directly on the user object or in a separate collection.
      // For simplicity, let's assume we might need to fetch profiles or checks if users have this field.
      
      if (agentId) {
        // This is tricky with CloudBase without joins. 
        // We might need to fetch TenantProfile/LandlordProfile matching representedById = agentId
        // and then filter users by those IDs.
        
        if (userType === 'TENANT') {
           const profiles = await db.query('tenant_profiles', { representedById: agentId })
           const userIds = profiles.map((p: any) => p.userId)
           users = users.filter((u: any) => userIds.includes(u.id))
        } else if (userType === 'LANDLORD') {
           const profiles = await db.query('landlord_profiles', { representedById: agentId })
           const userIds = profiles.map((p: any) => p.userId)
           users = users.filter((u: any) => userIds.includes(u.id))
        }
      }

      if (query) {
        const lowerQuery = query.toLowerCase()
        users = users.filter((u: any) => 
          (u.name && u.name.toLowerCase().includes(lowerQuery)) ||
          (u.email && u.email.toLowerCase().includes(lowerQuery))
        )
      }

      // Apply pagination
      const paginatedUsers = users.slice(offset, offset + limit)
      return NextResponse.json(paginatedUsers)
    } else {
      // Prisma implementation for Global region
      const where: any = {}
      
      if (userType) {
        where.userType = userType
      }

      if (agentId) {
        if (userType === 'TENANT') {
          where.tenantProfile = {
            representedById: agentId
          }
        } else if (userType === 'LANDLORD') {
          where.landlordProfile = {
            representedById: agentId
          }
        } else {
          // If no userType specified but agentId is, maybe searching for both?
          // Prisma doesn't support OR across relations easily in top-level where without strict typing
          // Let's assume userType is usually provided when filtering by agentId
        }
      }

      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ]
      }

      const users = await prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          tenantProfile: true,
          landlordProfile: true,
          agentProfile: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return NextResponse.json(users)
    }
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    )
  }
}
