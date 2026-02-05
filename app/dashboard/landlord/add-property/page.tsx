"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"
import { X, Upload } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"

export default function AddPropertyPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('property')
  const tCommon = useTranslations('common')
  const currencySymbol = getCurrencySymbol()
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    address: "",
    city: "",
    state: "",
    businessArea: "",
    zipCode: "",
    price: "",
    deposit: "",
    bedrooms: "",
    bathrooms: "",
    sqft: "",
    propertyType: "APARTMENT",
    petFriendly: false,
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > 5) {
      toast({
        title: tCommon('error'),
        description: t('tooManyImages') || "You can upload maximum 5 images",
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    try {
      const newImages: string[] = []
      
      for (let i = 0; i < files.length && images.length + newImages.length < 5; i++) {
        const file = files[i]
        // Convert to base64 for now (in production, upload to cloud storage)
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
        title: tCommon('error'),
        description: error.message || t('failedToUploadImages') || "Failed to upload images",
        variant: "destructive",
      })
      setUploading(false)
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const token = localStorage.getItem("auth-token")
    if (!token) {
      toast({
        title: tCommon('error'),
        description: t('loginToAddProperties') || "You need to be logged in to add properties",
        variant: "destructive",
      })
      router.push("/auth/login")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          deposit: parseFloat(formData.deposit),
          bedrooms: parseInt(formData.bedrooms),
          bathrooms: parseFloat(formData.bathrooms),
          sqft: formData.sqft ? parseInt(formData.sqft) : null,
          images: images,
          amenities: [],
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: tCommon('success'),
          description: t('propertyCreated') || "Your property has been successfully listed",
        })
        router.push("/dashboard/landlord")
      } else {
        throw new Error(data.details || data.error || t('createPropertyFailed') || "Failed to create property")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('addProperty')}</h1>
          <p className="text-muted-foreground">{t('listNewProperty') || "List a new property for rent"}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('propertyDetails')}</CardTitle>
            <CardDescription>{t('fillPropertyInfo') || "Fill in the information about your property"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t('propertyTitle') || "Property Title"} *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyType">{t('propertyType') || "Property Type"} *</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APARTMENT">{t('apartment') || "公寓"}</SelectItem>
                      <SelectItem value="STUDIO">{t('studio') || "工作室"}</SelectItem>
                      <SelectItem value="VILLA">{t('villa') || "别墅"}</SelectItem>
                      <SelectItem value="LUXURY">{t('luxury') || "豪华公寓"}</SelectItem>
                      <SelectItem value="TOWNHOUSE">{t('townhouse') || "联排住宅"}</SelectItem>
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

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <Label htmlFor="state">{t('district') || t('state')} *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder={t('districtPlaceholder') || "行政区"}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessArea">{t('businessArea') || "商圈"}</Label>
                  <Input
                    id="businessArea"
                    value={formData.businessArea || ""}
                    onChange={(e) => setFormData({ ...formData, businessArea: e.target.value })}
                    placeholder={t('businessAreaPlaceholder') || "商圈"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">{t('zipCode') || "Zip Code"}</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t('monthlyRent') || "Monthly Rent"} ({currencySymbol}) *</Label>
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
                <Label htmlFor="sqft">{t('buildingArea') || t('sqft') || "建筑面积"}</Label>
                <Input
                  id="sqft"
                  type="number"
                  value={formData.sqft}
                  onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
                  placeholder={t('buildingAreaPlaceholder') || "平方米"}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('uploadImages') || t('propertyImages') || "上传图片"} (1-5 {t('images')})</Label>
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
                        <span className="text-sm text-muted-foreground">{t('upload') || "Upload"}</span>
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
                  {images.length}/5 {t('imagesUploaded') || "images uploaded"}
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

              <Button type="submit" className="w-full" size="lg" disabled={loading || uploading}>
                {loading ? (tCommon('loading')) : uploading ? (t('uploading') || "Uploading...") : (t('createProperty') || "Create Property")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
