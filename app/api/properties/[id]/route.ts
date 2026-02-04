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
    const property = await db.findById('properties', params.id)

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    // 手动加载房东信息
    const landlord = await db.findUserById(property.landlordId)
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
