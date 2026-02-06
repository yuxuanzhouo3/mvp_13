import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

/**
 * 获取单个房源详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabaseAdapter()
    
    // 对于 CloudBase，可能需要使用 query 方法查询
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    
    console.log('Fetching property:', params.id, 'Region:', region)
    
    let property
    if (region === 'china') {
      // CloudBase: 先尝试使用 findById，如果失败则使用 query
      try {
        property = await db.findById('properties', params.id)
        if (property) {
          console.log('Property found via findById:', property.id || property._id)
        } else {
          console.log('FindById returned null, trying query method')
        }
      } catch (findError: any) {
        console.log('FindById failed, trying query method:', findError.message)
      }
      
      // 如果 findById 失败或返回 null，使用 query 方法查询所有房源，然后过滤
      if (!property) {
        try {
          const allProperties = await db.query('properties', {})
          console.log('Total properties found via query:', allProperties.length)
          
          if (allProperties.length === 0) {
            console.warn('No properties found in database')
          } else {
            // 尝试多种ID匹配方式
            property = allProperties.find((p: any) => {
              // 支持多种ID字段格式
              const pId = String(p.id || p._id || p.propertyId || '')
              const searchId = String(params.id || '')
              const match = pId === searchId
              if (match) {
                console.log('Property matched:', { pId, searchId, title: p.title })
              }
              return match
            })
            
            if (!property) {
              console.log('Property not found in query results. Search ID:', params.id)
              console.log('Available IDs (first 10):', 
                allProperties.slice(0, 10).map((p: any) => ({ 
                  id: p.id, 
                  _id: p._id, 
                  propertyId: p.propertyId,
                  title: p.title 
                })))
            }
          }
        } catch (queryError: any) {
          console.error('Query error:', queryError)
          // 如果 query 也失败，尝试直接使用 findById 的原始方法
          try {
            const { db: cloudbaseDb } = await import('./cloudbase')
            const result = await cloudbaseDb
              .collection('properties')
              .doc(String(params.id))
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
      // Supabase: 使用 findById
      property = await db.findById('properties', params.id)
    }

    if (!property) {
      console.error('Property not found:', params.id, 'Region:', region)
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }
    
    console.log('Property found:', property.id || property._id, property.title)

    // 手动加载房东信息
    const landlordId = property.landlordId || property.landlord?._id || property.landlord?.id
    if (!landlordId) {
      console.error('Property has no landlordId:', property)
      return NextResponse.json(
        { error: 'Property landlord not found' },
        { status: 404 }
      )
    }

    const landlord = await db.findUserById(landlordId)
    const propertyWithLandlord = {
      ...property,
      landlord: landlord ? {
        id: landlord.id,
        name: landlord.name,
        email: landlord.email,
        phone: landlord.phone,
      } : null,
    }

    return NextResponse.json({ property: propertyWithLandlord })
  } catch (error: any) {
    console.error('Get property error:', error)
    return NextResponse.json(
      { error: 'Failed to get property', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * 更新房源
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    if (property.landlordId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to update this property' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updatedProperty = await db.update('properties', params.id, body)

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
  { params }: { params: { id: string } }
) {
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

    if (property.landlordId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to delete this property' },
        { status: 403 }
      )
    }

    await db.delete('properties', params.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete property error:', error)
    return NextResponse.json(
      { error: 'Failed to delete property', details: error.message },
      { status: 500 }
    )
  }
}
