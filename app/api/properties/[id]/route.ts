import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * 获取单个房源详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: params.id },
      include: {
        landlord: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    })

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ property })
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
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const property = await prisma.property.findUnique({
      where: { id: params.id }
    })

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    if (property.landlordId !== user.userId) {
      return NextResponse.json(
        { error: 'Not authorized to update this property' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updatedProperty = await prisma.property.update({
      where: { id: params.id },
      data: body
    })

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
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const property = await prisma.property.findUnique({
      where: { id: params.id }
    })

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      )
    }

    if (property.landlordId !== user.userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this property' },
        { status: 403 }
      )
    }

    await prisma.property.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete property error:', error)
    return NextResponse.json(
      { error: 'Failed to delete property', details: error.message },
      { status: 500 }
    )
  }
}
