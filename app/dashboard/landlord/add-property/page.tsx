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
import { compressImage } from "@/lib/image-compress"

export default function AddPropertyPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('property')
  const tCommon = useTranslations('common')
  const currencySymbol = getCurrencySymbol()
  // 在客户端直接使用环境变量，避免导入 CloudBase SDK
  const isChina = (process.env.NEXT_PUBLIC_APP_REGION || 'global') === 'china'
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    address: "",
    city: "",
    state: "",
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
    if (!files || files.length === 0) {
      // 重置 input，允许重新选择
      e.target.value = ''
      return
    }

    // 国内版限制更严格（最多2张），国际版较宽松（最多5张）
    // 前端统一使用较严格的限制，后端会根据实际区域进一步处理
    const maxImages = 5 // 前端允许最多5张，后端会根据区域限制

    if (images.length + files.length > maxImages) {
      toast({
        title: tCommon('error'),
        description: t('tooManyImages') || `最多只能上传 ${maxImages} 张图片`,
        variant: "destructive",
      })
      // 重置 input
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      const newImages: string[] = []
      const fileArray = Array.from(files).slice(0, maxImages - images.length)
      
      // 使用 Promise.all 并行处理所有图片
      const compressPromises = fileArray.map(async (file) => {
        try {
          // 压缩图片：对于 CloudBase，需要更小的图片
          // 最大尺寸 1200x1200，质量 0.7，目标大小 40KB（base64 约 55KB）
          const compressedBase64 = await compressImage(file, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.7,
            maxSize: 40 * 1024, // 40KB 原始图片，base64 约 55KB
          })
          
          // 检查压缩后的 base64 大小（严格限制为 60KB）
          if (compressedBase64.length > 60000) {
            console.warn(`图片 ${file.name} 压缩后仍然较大 (${Math.round(compressedBase64.length / 1024)}KB)，尝试进一步压缩`)
            // 进一步压缩
            const furtherCompressed = await compressImage(file, {
              maxWidth: 800,
              maxHeight: 800,
              quality: 0.6,
              maxSize: 30 * 1024, // 30KB 原始图片
            })
            if (furtherCompressed.length <= 60000) {
              return furtherCompressed
            }
            // 如果还是太大，截断
            const commaIndex = furtherCompressed.indexOf(',')
            if (commaIndex > 0) {
              const prefix = furtherCompressed.substring(0, commaIndex + 1)
              const base64Data = furtherCompressed.substring(commaIndex + 1)
              const truncatedBase64 = base64Data.substring(0, 60000 - prefix.length)
              return prefix + truncatedBase64
            }
            return furtherCompressed.substring(0, 60000)
          }
          
          return compressedBase64
        } catch (error: any) {
          console.error(`压缩图片 ${file.name} 失败:`, error)
          toast({
            title: tCommon('error'),
            description: `图片 ${file.name} 处理失败: ${error.message}`,
            variant: "destructive",
          })
          return null
        }
      })
      
      const compressedResults = await Promise.all(compressPromises)
      
      // 过滤掉失败的结果
      const validImages = compressedResults.filter((img): img is string => img !== null)
      
      if (validImages.length > 0) {
        setImages(prev => [...prev, ...validImages])
        toast({
          title: tCommon('success'),
          description: `Successfully uploaded ${validImages.length} ${validImages.length === 1 ? 'image' : 'images'}`,
        })
      }
      
    } catch (error: any) {
      console.error('图片上传错误:', error)
      toast({
        title: tCommon('error'),
        description: error.message || t('failedToUploadImages') || "上传图片失败",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      // 重置 input，允许重新选择
      e.target.value = ''
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
          businessArea: '', // 不需要商圈，设为空字符串
          zipCode: '', // 不需要邮编，设为空字符串
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Label htmlFor="state">{isChina ? '行政区' : 'District'} *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
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
                <Label htmlFor="sqft">{isChina ? "建筑面积" : "Building Area"}</Label>
                <Input
                  id="sqft"
                  type="number"
                  value={formData.sqft}
                  onChange={(e) => setFormData({ ...formData, sqft: e.target.value })}
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
