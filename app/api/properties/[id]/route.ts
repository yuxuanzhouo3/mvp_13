import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'
import { prisma } from '@/lib/db'

// 定义 Next.js 15 的 params 类型
type Props = {
  params: Promise<{ id: string }>
}

const isConnectionError = (error: any) => {
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('server has closed the connection') ||
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('pool') ||
    msg.includes('maxclients')
}

const runWithRetry = async <T,>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn()
  } catch (error: any) {
    if (!isConnectionError(error)) {
      throw error
    }
    try {
      await prisma.$disconnect()
    } catch {}
    try {
      await prisma.$connect()
    } catch {}
    return await fn()
  }
}

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

/**
 * 获取单个房源详情
 */
export async function GET(
  request: NextRequest,
  props: Props
) {
  // 1. 在 Next.js 15 中，必须先 await params
  const params = await props.params;
  const searchId = String(params?.id || '').trim()
  if (!searchId) {
    return NextResponse.json({ property: null }, { status: 200 })
  }
  
  try {
    const db = getDatabaseAdapter()
    
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    
    console.log('Fetching property:', searchId, 'Region:', region)
    
    let property
    if (region === 'china') {
      try {
        property = await db.findById('properties', searchId)
        if (property) {
          console.log('Property found via findById:', property.id || property._id)
        } else {
          console.log('FindById returned null, trying query method')
        }
      } catch (findError: any) {
        console.log('FindById failed, trying query method:', findError.message)
      }
      
      if (!property) {
        try {
          const allProperties = await db.query('properties', {})
          console.log('Total properties found via query:', allProperties.length)
          
          if (allProperties.length === 0) {
            console.warn('No properties found in database')
          } else {
            property = allProperties.find((p: any) => {
              const pId = String(p.id || p._id || p.propertyId || '')
              return pId === searchId
            })
            
            if (!property) {
              console.log('Property not found in query results. Search ID:', searchId)
            }
          }
        } catch (queryError: any) {
          console.error('Query error:', queryError)
          try {
            // ✅ 修正点：使用 @/lib/cloudbase 绝对路径
            const { db: cloudbaseDb } = await import('@/lib/cloudbase')
            const result = await cloudbaseDb
              .collection('properties')
              .doc(searchId)
              .get()
            
            if (result.data) {
              const data = Array.isArray(result.data) ? result.data[0] : result.data
              if (data) {
                property = data
                console.log('Property found via direct CloudBase query')
              }
            }
          } catch (directError: any) {
            console.error('Direct CloudBase query also failed:', directError)
          }
        }
      }
    } else {
      // 国际版：Supabase/Prisma
      try {
        property = await db.findById('properties', searchId)
      } catch (error) {
        console.warn('db.findById failed, trying Prisma:', error)
      }
      
      if (!property) {
        try {
          property = await runWithRetry(() => prisma.property.findUnique({ where: { id: searchId } }))
        } catch (error) {
          console.warn('Prisma findUnique failed:', error)
        }
      }
      
      if (!property) {
        // 尝试通过query方法查找
        try {
          const fallbackList = await db.query('properties', {}, { take: 1000 })
          property = fallbackList.find((p: any) => {
            const pId = String(p.id || p._id || p.propertyId || p.property_id || '')
            return pId === searchId
          })
        } catch (fallbackError) {
          console.warn('Query fallback failed:', fallbackError)
        }
      }
      
      if (!property) {
        // 尝试通过备用ID查找
        property = await findPropertyByAlternateId(searchId)
      }
      
      if (!property) {
        // 最后尝试通过原始SQL查询（处理可能的表名大小写问题）
        try {
          const tableRows: any[] = await prisma.$queryRawUnsafe(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE $1`,
            'property'
          )
          const tableName = tableRows?.[0]?.table_name || 'Property'
          const rawResult = await prisma.$queryRawUnsafe(
            `SELECT * FROM "${tableName}" WHERE "id" = $1 LIMIT 1`,
            searchId
          )
          if (Array.isArray(rawResult) && rawResult.length > 0) {
            property = rawResult[0] as any
          }
        } catch (sqlError) {
          console.warn('Raw SQL query failed:', sqlError)
        }
      }
    }

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }
    
    const landlordId = property.landlordId || property.landlord?._id || property.landlord?.id
    let landlord = null
    if (landlordId) {
      try {
        landlord = await db.findUserById(landlordId)
      } catch {}
    }
    
    let agent = null
    if (property.agentId) {
      try {
        agent = await db.findUserById(property.agentId)
      } catch {}
    }

    const propertyWithLandlord = {
      ...property,
      landlord: landlord ? {
        id: landlord.id,
        name: landlord.name,
        email: landlord.email,
        phone: landlord.phone,
      } : null,
      agent: agent ? {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
      } : null,
    }

    return NextResponse.json({ property: propertyWithLandlord })
  } catch (error: any) {
    console.error('Get property error:', error)
    return NextResponse.json(
      { property: null },
      { status: 200 }
    )
  }
}

/**
 * 更新房源
 */
export async function PATCH(
  request: NextRequest,
  props: Props
) {
  const params = await props.params; // await params
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()
    const property = await db.findById('properties', params.id)

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 权限检查：房东、关联中介或代理中介
    const isLandlord = property.landlordId === user.id
    let isAgent = property.agentId === user.id

    if (!isLandlord && !isAgent && user.userType === 'AGENT') {
        try {
           const landlord = await db.findUserById(property.landlordId)
           if (landlord && landlord.representedById === user.id) {
               isAgent = true
           }
        } catch (err) {
            console.warn('Failed to check agent representation:', err)
        }
    }

    if (!isLandlord && !isAgent) {
      return NextResponse.json(
        { error: 'Not authorized to update this property' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updatedProperty = await runWithRetry(() => db.update('properties', params.id, body))

    return NextResponse.json({ property: updatedProperty })
  } catch (error: any) {
    console.error('Update property error:', error)
    return NextResponse.json(
      { error: 'Failed to update property', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 删除房源
 */
export async function DELETE(
  request: NextRequest,
  props: Props
) {
  const params = await props.params; // await params
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = getDatabaseAdapter()
    const property = await db.findById('properties', params.id)

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 权限检查：房东、关联中介或代理中介
    const isLandlord = property.landlordId === user.id
    let isAgent = property.agentId === user.id

    if (!isLandlord && !isAgent && user.userType === 'AGENT') {
        try {
           const landlord = await db.findUserById(property.landlordId)
           if (landlord && landlord.representedById === user.id) {
               isAgent = true
           }
        } catch (err) {
            console.warn('Failed to check agent representation:', err)
        }
    }

    if (!isLandlord && !isAgent) {
      return NextResponse.json(
        { error: 'Not authorized to delete this property' },
        { status: 403 }
      )
    }

    await runWithRetry(() => db.delete('properties', params.id))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete property error:', error)
    return NextResponse.json(
      { error: 'Failed to delete property', details: error.message },
      { status: 500 }
    )
  }
}
