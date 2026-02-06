import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-adapter'
import { getDatabaseAdapter } from '@/lib/db-adapter'

// 定义 Next.js 15 的 params 类型
type Props = {
  params: Promise<{ id: string }>
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
  
  try {
    const db = getDatabaseAdapter()
    
    const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
    
    console.log('Fetching property:', params.id, 'Region:', region)
    
    let property
    if (region === 'china') {
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
      
      if (!property) {
        try {
          const allProperties = await db.query('properties', {})
          console.log('Total properties found via query:', allProperties.length)
          
          if (allProperties.length === 0) {
            console.warn('No properties found in database')
          } else {
            property = allProperties.find((p: any) => {
              const pId = String(p.id || p._id || p.propertyId || '')
              const searchId = String(params.id || '')
              return pId === searchId
            })
            
            if (!property) {
              console.log('Property not found in query results. Search ID:', params.id)
            }
          }
        } catch (queryError: any) {
          console.error('Query error:', queryError)
          try {
            // ✅ 修正点：使用 @/lib/cloudbase 绝对路径
            const { db: cloudbaseDb } = await import('@/lib/cloudbase')
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
      property = await db.findById('properties', params.id)
    }

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }
    
    const landlordId = property.landlordId || property.landlord?._id || property.landlord?.id
    if (!landlordId) {
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