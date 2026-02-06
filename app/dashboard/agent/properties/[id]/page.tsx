"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Bed, Bath, Square, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"

export default function AgentPropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const currencySymbol = getCurrencySymbol()

  useEffect(() => {
    if (params.id) {
      fetchProperty()
    }
  }, [params.id])

  const fetchProperty = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        router.push("/auth/login")
        return
      }

      console.log('Fetching property with ID:', params.id)

      const response = await fetch(`/api/properties/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Property data received:', data)
        if (data.property) {
          setProperty(data.property)
        } else {
          throw new Error("Property data is missing")
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch property:', errorData)
        throw new Error(errorData.error || errorData.details || "Failed to fetch property")
      }
    } catch (error: any) {
      console.error('Fetch property error:', error)
      toast({
        title: process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '错误' : "Error",
        description: error.message || (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '加载房源失败' : "Failed to load property"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const images = property
    ? typeof property.images === "string"
      ? JSON.parse(property.images || "[]")
      : (property.images || [])
    : []
  const amenities = property
    ? typeof property.amenities === "string"
      ? JSON.parse(property.amenities || "[]")
      : (property.amenities || [])
    : []

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

  if (loading) {
    return (
      <DashboardLayout userType="agent">
        <div className="text-center py-12">
          {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '正在加载房源详情...' : 'Loading property details...'}
        </div>
      </DashboardLayout>
    )
  }

  if (!property) {
    return (
      <DashboardLayout userType="agent">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '未找到房源' : 'Property not found'}
          </p>
          <Button onClick={() => router.push("/dashboard/agent/properties")}>
            {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '返回房源列表' : 'Back to Properties'}
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/dashboard/agent/properties")}>
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
                {property.status && (
                  <Badge className="absolute top-4 left-4" variant={property.status === "AVAILABLE" ? "default" : "secondary"}>
                    {property.status}
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background"
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
                        <div className="font-semibold">{property.propertyType}</div>
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
                  onClick={() => {
                    const token = localStorage.getItem("auth-token")
                    if (!token) {
                      toast({
                        title: process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '请先登录' : "Please login",
                        description: process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '您需要登录才能发送消息' : "You need to login to send messages",
                        variant: "destructive",
                      })
                      router.push("/auth/login")
                      return
                    }
                    if (property.landlord?.id) {
                      router.push(`/dashboard/agent/messages?userId=${property.landlord.id}`)
                    } else {
                      toast({
                        title: process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '错误' : "Error",
                        description: process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '未找到房东信息' : "Landlord information not found",
                        variant: "destructive",
                      })
                    }
                  }}
                >
                  {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '联系房东' : 'Message Landlord'}
                </Button>
              </CardContent>
            </Card>

            {property.landlord && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '房东信息' : 'Landlord Information'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <div className="font-semibold">{property.landlord.name}</div>
                      <div className="text-sm text-muted-foreground">{property.landlord.email}</div>
                      {property.landlord.phone && (
                        <div className="text-sm text-muted-foreground">{property.landlord.phone}</div>
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
