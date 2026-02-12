import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma, withPrismaRetry } from '@/lib/db'

const findPropertyByAlternateId = async (searchId: string) => {
  try {
    const tableRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE $1`,
      'property'
    )
    const tableName = tableRows?.[0]?.table_name || 'Property'
    const columns: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
      tableName
    )
    const columnSet = new Set(columns.map((col: any) => String(col.column_name)))
    const candidates = ['propertyId', '_id', 'legacyId', 'property_id']
    for (const column of candidates) {
      if (!columnSet.has(column)) continue
      const result: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${tableName}" WHERE "${column}" = $1 LIMIT 1`,
        searchId
      )
      if (Array.isArray(result) && result.length > 0) {
        return result[0]
      }
    }
  } catch {}
  return null
}

const resolveUserId = async (db: ReturnType<typeof getDatabaseAdapter>, user: { id: string; email?: string }) => {
  try {
    const existing = await db.findUserById(user.id)
    if (existing) return existing.id
  } catch {}
  if (user.email) {
    try {
      const byEmail = await db.findUserByEmail(user.email)
      if (byEmail) return byEmail.id
    } catch {}
  }
  return user.id
}

/**
 * Get saved properties for current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const resolvedUserId = await resolveUserId(db, user)
    const savedProperties = await db.query('savedProperties', { userId: resolvedUserId })
    const savedPropertyIds = savedProperties
      .map((sp: any) => {
        // 获取propertyId，支持多种字段名
        const propId = sp?.propertyId ?? sp?.property_id ?? sp?.property?.id ?? sp?.property?._id ?? ''
        return String(propId).trim()
      })
      .filter(Boolean)

    // 排序
    savedProperties.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })

    // 加载房源信息
    const properties = await Promise.all(
      savedProperties.map(async (sp: any) => {
        const normalizedPropertyId = String(sp.propertyId || sp.property_id || sp.property?.id || sp.property?._id || '').trim()
        if (!normalizedPropertyId) return null
        
        let property = await db.findById('properties', normalizedPropertyId)
        if (!property && region !== 'china') {
          // 尝试通过Prisma直接查找
          try {
            property = await prisma.property.findUnique({ where: { id: normalizedPropertyId } })
          } catch (e) {
            console.warn('Prisma findUnique failed:', e)
          }
        }
        if (!property) {
          const fallbackList = await db.query('properties', {}, { take: 500 })
          property = fallbackList.find((p: any) => {
            const pId = String(p.id || p._id || p.propertyId || p.property_id || '')
            return pId === normalizedPropertyId
          })
        }
        if (!property && region !== 'china' && normalizedPropertyId) {
          property = await findPropertyByAlternateId(normalizedPropertyId)
        }
        if (!property) return null

        const landlord = await db.findUserById(property.landlordId)
        const images = Array.isArray(property.images) 
          ? property.images 
          : (typeof property.images === 'string' ? JSON.parse(property.images) : [])

        return {
          id: String(property.id || property._id || property.propertyId || property.property_id || normalizedPropertyId),
          propertyId: normalizedPropertyId,
          title: property.title,
          location: `${property.city}, ${property.state}`,
          price: property.price,
          beds: property.bedrooms,
          baths: property.bathrooms,
          sqft: property.sqft || 0,
          image: images[0] || '/placeholder.svg',
          status: property.status?.toLowerCase() || 'available',
        }
      })
    )

    return NextResponse.json({ properties: properties.filter(Boolean), savedPropertyIds })
  } catch (error: any) {
    console.error('Get saved properties error:', error)
    return NextResponse.json(
      { error: 'Failed to get saved properties', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Save a property
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { propertyId } = body
    const normalizedPropertyId = String(propertyId || '').trim()

    if (!normalizedPropertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    const db = getDatabaseAdapter()
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'

    // Check if already saved
    const resolvedUserId = await resolveUserId(db, user)
    const allSaved = await db.query('savedProperties', { userId: resolvedUserId })
    const existing = allSaved.find((sp: any) => {
      const spId = String(sp.propertyId || sp.property_id || sp.property?.id || sp.property?._id || '').trim()
      return spId === normalizedPropertyId
    })
    
    // 如果还没找到，尝试通过实际房源ID匹配
    if (!existing && region !== 'china') {
      let property = await db.findById('properties', normalizedPropertyId)
      if (!property) {
        try {
          property = await prisma.property.findUnique({ where: { id: normalizedPropertyId } })
        } catch (e) {
          console.warn('Prisma findUnique failed:', e)
        }
      }
      if (!property) {
        property = await findPropertyByAlternateId(normalizedPropertyId)
      }
      if (property?.id) {
        const realId = String(property.id).trim()
        const existingByRealId = allSaved.find((sp: any) => {
          const spId = String(sp.propertyId || sp.property_id || sp.property?.id || sp.property?._id || '').trim()
          return spId === realId
        })
        if (existingByRealId) {
          return NextResponse.json(
            { error: 'Property already saved' },
            { status: 400 }
          )
        }
      }
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Property already saved' },
        { status: 400 }
      )
    }

    let targetPropertyId = normalizedPropertyId
    if (region !== 'china') {
      // 首先尝试直接通过ID查找
      let property = await db.findById('properties', normalizedPropertyId)
      if (!property) {
        // 尝试通过Prisma直接查找，使用重试机制
        try {
          property = await withPrismaRetry(() => prisma.property.findUnique({ where: { id: normalizedPropertyId } }))
        } catch (e) {
          console.warn('Prisma findUnique failed:', e)
        }
      }
      if (!property) {
        // 尝试通过备用ID查找
        property = await findPropertyByAlternateId(normalizedPropertyId)
      }
      if (!property) {
        // 最后尝试通过query方法查找
        try {
          const allProperties = await db.query('properties', {}, { take: 1000 })
          property = allProperties.find((p: any) => {
            const pId = String(p.id || p._id || p.propertyId || p.property_id || '')
            return pId === normalizedPropertyId
          })
        } catch (e) {
          console.warn('Query fallback failed:', e)
        }
      }
      if (property?.id) {
        targetPropertyId = String(property.id)
      } else if (!property) {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        )
      }
    }

    let savedProperty
    try {
      if (region === 'global') {
        // 使用Prisma直接创建，带重试机制
        savedProperty = await withPrismaRetry(() => prisma.savedProperty.create({
          data: {
            userId: resolvedUserId,
            propertyId: targetPropertyId,
          }
        }))
      } else {
        savedProperty = await db.create('savedProperties', {
          userId: resolvedUserId,
          propertyId: targetPropertyId,
        })
      }
    } catch (createError: any) {
      console.error('Failed to create saved property:', createError)
      // 检查是否是唯一约束错误（已经保存过）
      const errorMsg = String(createError?.message || '').toLowerCase()
      const errorCode = String(createError?.code || '')
      
      if (errorMsg.includes('unique') || 
          errorMsg.includes('duplicate') || 
          errorMsg.includes('already exists') ||
          errorCode === 'P2002' || // Prisma unique constraint error
          errorCode === '23505') { // PostgreSQL unique violation
        return NextResponse.json(
          { error: 'Property already saved' },
          { status: 400 }
        )
      }
      
      // 返回更友好的错误信息
      return NextResponse.json(
        { error: 'Failed to save property', details: errorMsg || createError.message },
        { status: 500 }
      )
    }

    // 获取房源信息用于返回
    let propertyForResponse
    try {
      if (region === 'global') {
        propertyForResponse = await withPrismaRetry(() => prisma.property.findUnique({
          where: { id: targetPropertyId }
        }))
      } else {
        propertyForResponse = await db.findById('properties', targetPropertyId)
      }
    } catch (findError) {
      console.warn('Failed to fetch property for response:', findError)
      propertyForResponse = null
    }

    const savedPropertyWithProperty = {
      ...savedProperty,
      property: propertyForResponse,
    }

    return NextResponse.json({ savedProperty: savedPropertyWithProperty })
  } catch (error: any) {
    console.error('Save property error:', error)
    return NextResponse.json(
      { error: 'Failed to save property', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Remove saved property
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const propertyId = searchParams.get('propertyId')
    const normalizedPropertyId = String(propertyId || '').trim()

    if (!normalizedPropertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      )
    }

    const db = getDatabaseAdapter()
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    const resolvedUserId = await resolveUserId(db, user)
    const allSaved = await db.query('savedProperties', { userId: resolvedUserId })
    let savedProperty = allSaved.find((sp: any) => {
      const spId = String(sp.propertyId || sp.property_id || sp.property?.id || sp.property?._id || '')
      return spId === normalizedPropertyId
    })
    if (!savedProperty && region !== 'china') {
      // 尝试通过多种方式查找房源
      let property = await db.findById('properties', normalizedPropertyId)
      if (!property) {
        try {
          property = await prisma.property.findUnique({ where: { id: normalizedPropertyId } })
        } catch (e) {
          console.warn('Prisma findUnique failed:', e)
        }
      }
      if (!property) {
        property = await findPropertyByAlternateId(normalizedPropertyId)
      }
      if (!property) {
        // 最后尝试通过query方法查找
        try {
          const allProperties = await db.query('properties', {}, { take: 1000 })
          property = allProperties.find((p: any) => {
            const pId = String(p.id || p._id || p.propertyId || p.property_id || '')
            return pId === normalizedPropertyId
          })
        } catch (e) {
          console.warn('Query fallback failed:', e)
        }
      }
      if (property?.id) {
        const realId = String(property.id)
        savedProperty = allSaved.find((sp: any) => {
          const spId = String(sp.propertyId || sp.property_id || sp.property?.id || sp.property?._id || '')
          return spId === realId
        })
      }
    }

    if (savedProperty) {
      await db.delete('savedProperties', savedProperty.id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Remove saved property error:', error)
    return NextResponse.json(
      { error: 'Failed to remove saved property', details: error.message },
      { status: 500 }
    )
  }
}
