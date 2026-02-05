"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    avatar: "",
  })

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const user = JSON.parse(userStr)
      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        avatar: user.avatar || "",
      })
    }
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        toast({
          title: tCommon('error'),
          description: t('pleaseLoginAgain') || "Please login again",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          avatar: formData.avatar,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem("user", JSON.stringify(data.user))
        toast({
          title: tCommon('success'),
          description: t('profileUpdated') || "Profile updated successfully",
        })
        window.dispatchEvent(new Event("storage"))
      } else {
        const data = await response.json()
        throw new Error(data.error || t('updateProfileFailed') || "Failed to update profile")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || t('saveSettingsFailed') || "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return "U"
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
  }

  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('settings')}</h1>
          <p className="text-muted-foreground">{t('manageAccountSettings') || "Manage your account settings and preferences"}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('profileInformation') || "Profile Information"}</CardTitle>
            <CardDescription>{t('updatePersonalInfo') || "Update your personal information"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formData.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${formData.name || 'User'}`} />
                <AvatarFallback className="text-xl">{getInitials(formData.name)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold">{formData.name || tCommon('user')}</div>
                <div className="text-sm text-muted-foreground">{formData.email}</div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">{tAuth('name')}</Label>
              <Input
                id="name"
                placeholder={tAuth('name')}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{tAuth('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={tAuth('email')}
                value={formData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">{t('emailCannotBeChanged') || "Email cannot be changed"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{tAuth('phone')}</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={tAuth('phone')}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? tCommon('loading') : (t('saveChanges') || "Save Changes")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('notificationPreferences') || "Notification Preferences"}</CardTitle>
            <CardDescription>{t('chooseNotificationMethod') || "Choose how you want to be notified"}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t('notificationSettingsComingSoon') || "Notification settings coming soon"}</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
