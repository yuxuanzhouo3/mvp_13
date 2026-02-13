"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Bed, Bath, Square, Edit, ArrowLeft, X, Upload, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"

export default function LandlordPropertyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('property')
  const tDashboard = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const currencySymbol = getCurrencySymbol()
  const [userType, setUserType] = useState<string>("landlord")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    price: "",
    deposit: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    propertyType: "APARTMENT",
    petFriendly: false,
    status: "AVAILABLE",
  })

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

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const user = JSON.parse(userStr)
      if (user.userType?.toUpperCase() === "AGENT") setUserType("agent")
    }

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

      const response = await fetch(`/api/properties/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setProperty(data.property)
        const propertyImages = typeof data.property.images === 'string' 
          ? JSON.parse(data.property.images || '[]')
          : (data.property.images || [])
        setImages(propertyImages)
        setFormData({
          title: data.property.title,
          description: data.property.description,
          address: data.property.address,
          city: data.property.city,
          state: data.property.state,
          zipCode: data.property.zipCode,
          price: data.property.price.toString(),
          deposit: data.property.deposit.toString(),
          bedrooms: data.property.bedrooms.toString(),
          bathrooms: data.property.bathrooms.toString(),
          sqft: data.property.sqft?.toString() || "",
          propertyType: data.property.propertyType,
          petFriendly: data.property.petFriendly || false,
          status: data.property.status || "AVAILABLE",
        })
      } else {
        throw new Error(t('failedToLoad') || "Failed to fetch property")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error') || "Error",
        description: error.message || t('failedToLoad') || "Failed to load property",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > 5) {
      toast({
        title: "Too many images",
        description: "You can upload maximum 5 images",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    try {
      const newImages: string[] = []
      
      for (let i = 0; i < files.length && images.length + newImages.length < 5; i++) {
        const file = files[i]
        const reader = new FileReader()
        reader.onload = (event) => {
          const base64 = event.target?.result as string
          newImages.push(base64)
          
          if (newImages.length === Math.min(files.length, 5 - images.length)) {
            setImages(prev => [...prev, ...newImages])
            setUploading(false)
          }
        }
        reader.readAsDataURL(file)
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload images",
        variant: "destructive",
      })
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    const token = localStorage.getItem("auth-token")
    if (!token) return

    setSaving(true)
    try {
      const response = await fetch(`/api/properties/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          price: parseFloat(formData.price),
          deposit: parseFloat(formData.deposit),
          bedrooms: parseInt(formData.bedrooms),
          bathrooms: parseFloat(formData.bathrooms),
          sqft: formData.sqft ? parseInt(formData.sqft) : null,
          propertyType: formData.propertyType,
          petFriendly: formData.petFriendly,
          status: formData.status,
          images: images,
        }),
      })

      if (response.ok) {
        toast({
          title: "Property updated",
          description: "Your property has been updated successfully",
        })
        setEditing(false)
        fetchProperty()
      } else {
        const data = await response.json()
        throw new Error(data.error || "Failed to update property")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update property",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout userType={userType as any}>
        <div className="text-center py-12">{tCommon('loading') || "Loading property details..."}</div>
      </DashboardLayout>
    )
  }

  if (!property) {
    return (
      <DashboardLayout userType={userType as any}>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">{t('notFound') || "Property not found"}</p>
          <Button onClick={() => router.push(userType === "agent" ? "/dashboard/agent" : "/dashboard/landlord")}>{tDashboard('backToDashboard') || "Back to Dashboard"}</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userType={userType as any}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push(userType === "agent" ? "/dashboard/agent" : "/dashboard/landlord")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tCommon('back') || "Back"}
          </Button>
          {!editing && (
            <Button onClick={() => setEditing(true)}>
              <Edit className="mr-2 h-4 w-4" />
              {t('edit') || "Edit Property"}
            </Button>
          )}
        </div>

        {editing ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Property</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">{t('propertyTitle')} *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="propertyType">{t('propertyType')} *</Label>
                    <Select
                      value={formData.propertyType}
                      onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APARTMENT">{t('apartment')}</SelectItem>
                        <SelectItem value="HOUSE">{t('house')}</SelectItem>
                        <SelectItem value="CONDO">{t('condo')}</SelectItem>
                        <SelectItem value="STUDIO">{t('studio')}</SelectItem>
                        <SelectItem value="TOWNHOUSE">{t('townhouse')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('description')} *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t('address')} *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t('city')} *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">{t('state')} *</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">{t('zipCode')}</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">{t('monthlyRent')} ({currencySymbol}) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deposit">{t('deposit')} ({currencySymbol}) *</Label>
                    <Input
                      id="deposit"
                      type="number"
                      value={formData.deposit}
                      onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bedrooms">{t('bedrooms')} *</Label>
                    <Input
                      id="bedrooms"
                      type="number"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bathrooms">{t('bathrooms')} *</Label>
                    <Input
                      id="bathrooms"
                      type="number"
                      step="0.5"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sqft">{t('sqft')}</Label>
                  <Input
                    id="sqft"
                    type="number"
                    value={formData.sqft}
                    onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('status')} *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVAILABLE">{t('available')}</SelectItem>
                      <SelectItem value="OCCUPIED">{t('occupied')}</SelectItem>
                      <SelectItem value="MAINTENANCE">{t('maintenance')}</SelectItem>
                      <SelectItem value="PENDING">{t('pending')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('propertyImages')} (1-5 {t('images')})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {images.map((img, index) => (
                      <div key={index} className="relative">
                        <img
                          src={img}
                          alt={`Property image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    {images.length < 5 && (
                      <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                        <div className="text-center">
                          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{t('upload')}</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleImageUpload}
                          disabled={uploading}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {images.length}/5 {t('imagesUploaded')}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="petFriendly"
                    checked={formData.petFriendly}
                    onChange={(e) => setFormData({ ...formData, petFriendly: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="petFriendly">{t('petFriendly')}</Label>
                </div>

                <div className="flex space-x-4">
                  <Button type="submit" disabled={saving || uploading}>
                    {saving ? t('saving') : uploading ? t('uploading') : tCommon('saveChanges')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => {
                    setEditing(false)
                    fetchProperty()
                  }}>
                    {tCommon('cancel')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
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
                    {t(property.status?.toLowerCase()) || property.status}
                  </Badge>
                  )}
                  {/* Image navigation buttons */}
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
                        {images.map((_, index) => (
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
                {/* Thumbnail gallery */}
                {images.length > 1 && (
                  <div className="p-4 border-b">
                    <div className="flex space-x-2 overflow-x-auto">
                      {images.map((img, index) => (
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
                      <h3 className="text-xl font-semibold mb-4">{t('description')}</h3>
                      <p className="text-muted-foreground">{property.description || t('noDescription') || "No description available."}</p>
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold mb-4">{t('propertyDetails')}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center space-x-2">
                          <Bed className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-semibold">{property.bedrooms}</div>
                            <div className="text-sm text-muted-foreground">{t('bedrooms')}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Bath className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-semibold">{property.bathrooms}</div>
                            <div className="text-sm text-muted-foreground">{t('bathrooms')}</div>
                          </div>
                        </div>
                        {property.sqft && (
                          <div className="flex items-center space-x-2">
                            <Square className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-semibold">{property.sqft}</div>
                              <div className="text-sm text-muted-foreground">{t('sqft')}</div>
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{t(property.propertyType?.toLowerCase()) || property.propertyType}</div>
                          <div className="text-sm text-muted-foreground">{t('propertyType')}</div>
                        </div>
                      </div>
                    </div>

                    {property.petFriendly && (
                      <div>
                        <Badge variant="default">{t('petFriendly')}</Badge>
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
                    <span className="text-lg font-normal text-muted-foreground">/{t('month')}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('deposit')}:</span>
                      <span className="font-semibold">{currencySymbol}{property.deposit.toLocaleString()}</span>
                    </div>
                    {property.availableFrom && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('availableFrom')}:</span>
                        <span className="font-semibold">
                          {new Date(property.availableFrom).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {property.leaseDuration && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('leaseDuration')}:</span>
                        <span className="font-semibold">{property.leaseDuration} {t('months')}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
