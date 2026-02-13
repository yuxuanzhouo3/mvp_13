"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Bed, Bath, Square, Heart, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"

export default function TenantPropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const currencySymbol = getCurrencySymbol()

  useEffect(() => {
    if (params.id) {
      fetchProperty()
      checkSaved()
    }
  }, [params.id, property?.id])

  const fetchProperty = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      console.log('Tenant fetching property with ID:', params.id)

      const response = await fetch(`/api/properties/${params.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Tenant property data received:', data)
        setProperty(data.property || null)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Tenant failed to fetch property:', errorData)
        setProperty(null)
      }
    } catch (error: any) {
      console.error('Tenant fetch property error:', error)
      setProperty(null)
    } finally {
      setLoading(false)
    }
  }

  const checkSaved = async () => {
    const token = localStorage.getItem("auth-token")
    if (!token || !params.id) return

    try {
      const response = await fetch("/api/saved-properties", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        const savedIds = Array.isArray(data.savedPropertyIds)
          ? data.savedPropertyIds.map((id: any) => String(id).trim())
          : (data.properties || []).map((p: any) => String(p?.id ?? p?._id ?? p?.propertyId ?? p?.property_id ?? '').trim())
        
        // 检查多个可能的ID格式
        const candidates = new Set(
          [
            String(params.id || '').trim(),
            String(property?.id || '').trim(),
            String(property?._id || '').trim(),
            String(property?.propertyId || '').trim(),
          ].filter(Boolean)
        )
        const saved = savedIds.some((id: string) => {
          const normalizedId = String(id).trim()
          return candidates.has(normalizedId)
        })
        setIsSaved(saved)
      }
    } catch (error) {
      // Silent fail
      console.warn('Failed to check saved status:', error)
    }
  }

  const handleSave = async () => {
    const token = localStorage.getItem("auth-token")
    if (!token) {
      toast({
        title: "Please login",
        description: "You need to login to save properties",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      if (isSaved) {
        const response = await fetch(`/api/saved-properties?propertyId=${params.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          setIsSaved(false)
          toast({
            title: "Removed",
            description: "Property removed from saved list",
          })
        }
      } else {
        const response = await fetch("/api/saved-properties", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ propertyId: params.id }),
        })
        if (response.ok) {
          setIsSaved(true)
          toast({
            title: "Saved",
            description: "Property added to saved list",
          })
        } else {
          const data = await response.json()
          // 如果返回"already saved"错误，说明已经收藏了，更新状态
          if (data.error && data.error.includes('already saved')) {
            setIsSaved(true)
            toast({
              title: "Info",
              description: "Property is already saved",
            })
            return
          }
          throw new Error(data.error || "Failed to save property")
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save property",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout userType="tenant">
        <div className="text-center py-12">
          {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '正在加载房源详情...' : 'Loading property details...'}
        </div>
      </DashboardLayout>
    )
  }

  if (!property) {
    return (
      <DashboardLayout userType="tenant">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '未找到房源' : 'Property not found'}
          </p>
          <Button onClick={() => router.push(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? "/search" : "/dashboard/tenant")}>
            {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '返回搜索' : 'Back to Search'}
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const images = typeof property.images === 'string' 
    ? JSON.parse(property.images || '[]')
    : (property.images || [])
  const amenities = typeof property.amenities === 'string'
    ? JSON.parse(property.amenities || '[]')
    : (property.amenities || [])

  const getLocalizedPropertyType = (type: string | undefined) => {
    if (!type) return ''
    const upper = String(type).toUpperCase()
    if (process.env.NEXT_PUBLIC_APP_REGION !== 'china') return upper
    const map: Record<string, string> = {
      'APARTMENT': '公寓',
      'HOUSE': '房屋',
      'CONDO': '公寓',
      'STUDIO': '工作室',
      'TOWNHOUSE': '联排住宅',
      'VILLA': '别墅',
      'LUXURY': '豪华公寓'
    }
    return map[upper] || upper
  }

  const nextImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
  }

  const prevImage = () => {
    if (images.length > 1) {
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '返回' : 'Back'}
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="relative h-96">
                <Image
                  src={images[currentImageIndex] || "/placeholder.svg"}
                  alt={property.title}
                  fill
                  className="object-cover rounded-t-lg"
                />
                <div className="absolute top-4 right-4">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleSave}
                    disabled={saving}
                    className={isSaved ? "bg-red-500 hover:bg-red-600" : ""}
                  >
                    <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                  </Button>
                </div>
                {property.status && (
                  <Badge className="absolute top-4 left-4" variant={property.status === "AVAILABLE" ? "default" : "secondary"}>
                    {process.env.NEXT_PUBLIC_APP_REGION === 'china' 
                      ? (property.status === 'AVAILABLE' ? '可租' 
                          : property.status === 'OCCUPIED' ? '已租'
                          : property.status === 'MAINTENANCE' ? '维护中'
                          : property.status === 'PENDING' ? '待审核'
                          : property.status)
                      : property.status}
                  </Badge>
                )}
                {images.length > 1 && (
                  <>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                      onClick={prevImage}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute right-14 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
                      onClick={nextImage}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                      {images.map((_: string, index: number) => (
                        <button
                          key={index}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            index === currentImageIndex ? "bg-primary" : "bg-white/50"
                          }`}
                          onClick={() => setCurrentImageIndex(index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="p-4 border-b">
                  <div className="flex space-x-2 overflow-x-auto">
                    {images.map((img: string, index: number) => (
                      <button
                        key={index}
                        className={`relative w-20 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                          index === currentImageIndex ? "border-primary" : "border-transparent"
                        }`}
                        onClick={() => setCurrentImageIndex(index)}
                      >
                        <Image
                          src={img}
                          alt={`Thumbnail ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-3xl">{property.title}</CardTitle>
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span>{property.address}, {property.city}, {property.state} {property.zipCode}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">
                      {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '房源描述' : 'Description'}
                    </h3>
                    <p className="text-muted-foreground">
                      {property.description || (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '暂无描述' : "No description available.")}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-4">
                      {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '房源详情' : 'Property Details'}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <Bed className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-semibold">{property.bedrooms}</div>
                          <div className="text-sm text-muted-foreground">
                            {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '卧室' : 'Bedrooms'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Bath className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-semibold">{property.bathrooms}</div>
                          <div className="text-sm text-muted-foreground">
                            {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '浴室' : 'Bathrooms'}
                          </div>
                        </div>
                      </div>
                      {property.sqft && (
                        <div className="flex items-center space-x-2">
                          <Square className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-semibold">{property.sqft}</div>
                            <div className="text-sm text-muted-foreground">
                              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '平方米' : 'Sqft'}
                            </div>
                          </div>
                        </div>
                      )}
                      <div>
                      <div className="font-semibold">{getLocalizedPropertyType(property.propertyType)}</div>
                        <div className="text-sm text-muted-foreground">
                          {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '类型' : 'Type'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {amenities.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold mb-4">
                        {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '设施' : 'Amenities'}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {amenities.map((amenity: string, index: number) => (
                          <Badge key={index} variant="secondary">{amenity}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {property.petFriendly && (
                    <div>
                      <Badge variant="default">
                        {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '允许宠物' : 'Pet Friendly'}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">
                  {currencySymbol}{property.price.toLocaleString()}
                  <span className="text-lg font-normal text-muted-foreground">/month</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '押金：' : 'Deposit:'}
                    </span>
                    <span className="font-semibold">{currencySymbol}{property.deposit.toLocaleString()}</span>
                  </div>
                  {property.availableFrom && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '可入住日期：' : 'Available From:'}
                      </span>
                      <span className="font-semibold">
                        {new Date(property.availableFrom).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {property.leaseDuration && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '租期：' : 'Lease Duration:'}
                      </span>
                      <span className="font-semibold">
                        {property.leaseDuration} {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '个月' : 'months'}
                      </span>
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => router.push(`/dashboard/tenant/apply?propertyId=${params.id}`)}
                >
                  {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '立即申请' : 'Apply Now'}
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    const targetUser = property.agent || property.landlord
                    if (targetUser) {
                      router.push(`/dashboard/tenant/messages?userId=${targetUser.id}`)
                    }
                  }}
                >
                  {process.env.NEXT_PUBLIC_APP_REGION === 'china' 
                    ? (property.agent ? '联系中介' : '联系房东') 
                    : (property.agent ? 'Contact Agent' : 'Contact Landlord')}
                </Button>
              </CardContent>
            </Card>

            {(property.agent || property.landlord) && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {process.env.NEXT_PUBLIC_APP_REGION === 'china' 
                      ? (property.agent ? '中介信息' : '房东信息') 
                      : (property.agent ? 'Agent Information' : 'Landlord Information')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <div className="font-semibold">{(property.agent || property.landlord)?.name}</div>
                      <div className="text-sm text-muted-foreground">{(property.agent || property.landlord)?.email}</div>
                      {(property.agent || property.landlord)?.phone && (
                        <div className="text-sm text-muted-foreground">{(property.agent || property.landlord)?.phone}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
