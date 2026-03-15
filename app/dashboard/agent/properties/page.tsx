"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PropertyCard } from "@/components/dashboard/property-card"
import { Plus, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { getPrimaryImage } from "@/lib/utils"

export default function AgentPropertiesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Landlord selection state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [landlords, setLandlords] = useState<any[]>([])
  const [selectedLandlordId, setSelectedLandlordId] = useState<string>("")
  const [loadingLandlords, setLoadingLandlords] = useState(false)

  useEffect(() => {
    fetchProperties()
  }, [])

  const cleanText = (text: string) => {
    return text?.replace(/^(property\.|dashboard\.|common\.|application\.|payment\.)/i, '') || text
  }

  const fetchProperties = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/agent/properties", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setProperties(data.properties || [])
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error)
      toast({
        title: tCommon('error'),
        description: t('loadPropertiesFailed') || "Failed to load properties",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchLandlords = async () => {
    setLoadingLandlords(true)
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/agent/landlords", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        const landlordList = data.landlords || []
        setLandlords(landlordList)
        return landlordList
      }
    } catch (error) {
      console.error("Failed to fetch landlords:", error)
      toast({
        title: tCommon('error'),
        description: isChina ? "获取房东列表失败" : "Failed to fetch landlords",
        variant: "destructive",
      })
    } finally {
      setLoadingLandlords(false)
    }
    return []
  }

  const handleAddPropertyClick = async () => {
    setSelectedLandlordId("")
    const landlordList = await fetchLandlords()
    if (landlordList.length === 0) {
      toast({
        title: tCommon('info') || "Info",
        description: cleanText(t('noLandlordsYet') || (isChina ? "请先关联房东再添加房源" : "Please connect with a landlord first")),
      })
      router.push("/dashboard/agent/landlords")
      return
    }
    if (landlordList.length === 1) {
      const onlyLandlordId = String(landlordList[0]?.id || "")
      if (onlyLandlordId) {
        router.push(`/dashboard/agent/add-property?landlordId=${onlyLandlordId}`)
        return
      }
    }
    setIsAddDialogOpen(true)
  }

  const handleConfirmAdd = () => {
    if (!selectedLandlordId) {
      toast({
        title: tCommon('error'),
        description: isChina ? "请选择房东" : "Please select a landlord",
        variant: "destructive",
      })
      return
    }
    setIsAddDialogOpen(false)
    router.push(`/dashboard/agent/add-property?landlordId=${selectedLandlordId}`)
  }

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{cleanText(t('managedProperties'))}</h1>
            <p className="text-muted-foreground">{cleanText(t('propertiesUnderYourManagement'))}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{cleanText(t('propertyPortfolio') || "Property Portfolio")}</CardTitle>
                <CardDescription>{cleanText(t('searchAndManageListings') || "Manage your property listings")}</CardDescription>
              </div>
              <Button onClick={handleAddPropertyClick}>
                <Plus className="mr-2 h-4 w-4" />
                {cleanText(t('addPropertyForLandlord') || (isChina ? "为房东添加房源" : "Add Property for Landlord"))}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{cleanText(tCommon('loading'))}</div>
            ) : properties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property: any) => (
                  <PropertyCard
                    key={property.id}
                    property={{
                      id: property.id,
                      title: cleanText(property.title),
                      location: `${property.city}, ${property.state}`,
                      price: property.price,
                      beds: property.bedrooms,
                      baths: property.bathrooms,
                      sqft: property.sqft || 0,
                      image: getPrimaryImage(property.images ?? property.image),
                      status: cleanText(property.status?.toLowerCase() || 'available'),
                    }}
                    showSaveButton={false}
                    showManagementActions={true}
                    userRole="AGENT"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>{cleanText(t('noPropertiesFound') || (isChina ? "未找到房源" : "No properties found"))}</p>
                <p className="text-sm mt-2">{cleanText(t('connectWithLandlords') || (isChina ? "请先与房东建立联系以便管理其房源" : "Connect with landlords to manage their properties"))}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{cleanText(isChina ? "选择房东" : "Select Landlord")}</DialogTitle>
              <DialogDescription>
                {cleanText(isChina ? "请选择要为其添加房源的房东" : "Please select the landlord you want to add a property for.")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="landlord" className="text-right">
                  {cleanText(isChina ? "房东" : "Landlord")}
                </Label>
                <div className="col-span-3">
                  {loadingLandlords ? (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{cleanText(tCommon('loading'))}</span>
                    </div>
                  ) : (
                    <Select value={selectedLandlordId} onValueChange={setSelectedLandlordId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={cleanText(isChina ? "选择房东" : "Select a landlord")} />
                      </SelectTrigger>
                      <SelectContent>
                        {landlords.length > 0 ? (
                          landlords.map((landlord) => (
                            <SelectItem key={landlord.id} value={landlord.id}>
                              {landlord.name} ({landlord.email})
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            {cleanText(isChina ? "无关联房东" : "No connected landlords")}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                {cleanText(tCommon('cancel') || (isChina ? "取消" : "Cancel"))}
              </Button>
              <Button type="submit" onClick={handleConfirmAdd} disabled={!selectedLandlordId || loadingLandlords || landlords.length === 0}>
                {cleanText(tCommon('confirm') || (isChina ? "确认" : "Confirm"))}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
