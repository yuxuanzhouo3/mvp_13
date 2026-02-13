"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ModeToggle } from "@/components/mode-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  Shield,
  Home,
  Search,
  Heart,
  FileText,
  CreditCard,
  MessageSquare,
  Settings,
  Bell,
  Plus,
  Users,
  BarChart3,
  Gavel,
  LogOut,
  User,
  Star,
} from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
  userType: "tenant" | "landlord" | "agent" | "admin"
}

export function DashboardLayout({ children, userType }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  
  const navigationItems = {
    tenant: [
      {
        title: t('search'),
        items: [
          { title: t('search'), url: "/dashboard/tenant", icon: Search },
          { title: t('savedProperties'), url: "/dashboard/tenant/saved", icon: Heart },
          { title: t('applications'), url: "/dashboard/tenant/applications", icon: FileText },
        ],
      },
      {
        title: tCommon('user'),
        items: [
          { title: t('payments'), url: "/dashboard/tenant/payments", icon: CreditCard },
          { title: t('messages'), url: "/dashboard/tenant/messages", icon: MessageSquare },
          { title: t('reviews'), url: "/dashboard/tenant/reviews", icon: Star },
          { title: t('settings'), url: "/dashboard/tenant/settings", icon: Settings },
        ],
      },
    ],
    landlord: [
      {
        title: t('properties'),
        items: [
          { title: t('title'), url: "/dashboard/landlord", icon: Home },
          { title: t('addProperty'), url: "/dashboard/landlord/add-property", icon: Plus },
          { title: t('applications'), url: "/dashboard/landlord/applications", icon: FileText },
          { title: t('tenants'), url: "/dashboard/landlord/tenants", icon: Users },
        ],
      },
      {
        title: tCommon('user'),
        items: [
          { title: t('payments'), url: "/dashboard/landlord/payments", icon: CreditCard },
          { title: t('analytics'), url: "/dashboard/landlord/analytics", icon: BarChart3 },
          { title: t('messages'), url: "/dashboard/landlord/messages", icon: MessageSquare },
          { title: t('reviews'), url: "/dashboard/landlord/reviews", icon: Star },
          { title: t('settings'), url: "/dashboard/landlord/settings", icon: Settings },
        ],
      },
    ],
    agent: [
      {
        title: t('properties'),
        items: [
          { title: t('title'), url: "/dashboard/agent", icon: Home },
          { title: t('properties'), url: "/dashboard/agent/properties", icon: Home },
          { title: t('landlords'), url: "/dashboard/agent/landlords", icon: Users },
          { title: t('tenants'), url: "/dashboard/agent/tenants", icon: Users },
        ],
      },
      {
        title: t('payments'),
        items: [
          { title: t('transactions'), url: "/dashboard/agent/transactions", icon: CreditCard },
          { title: t('earnings'), url: "/dashboard/agent/earnings", icon: BarChart3 },
          { title: t('messages'), url: "/dashboard/agent/messages", icon: MessageSquare },
          { title: t('reviews'), url: "/dashboard/agent/reviews", icon: Star },
          { title: t('settings'), url: "/dashboard/agent/settings", icon: Settings },
        ],
      },
    ],
    admin: [
      {
        title: t('properties'),
        items: [
          { title: t('title'), url: "/dashboard/admin", icon: BarChart3 },
          { title: t('users'), url: "/dashboard/admin/users", icon: Users },
          { title: t('properties'), url: "/dashboard/admin/properties", icon: Home },
          { title: "Disputes", url: "/dashboard/admin/disputes", icon: Gavel },
        ],
      },
      {
        title: "System",
        items: [
          { title: t('analytics'), url: "/dashboard/admin/analytics", icon: BarChart3 },
          { title: t('settings'), url: "/dashboard/admin/settings", icon: Settings },
        ],
      },
    ],
  }
  
  const navigation = navigationItems[userType]
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    // Load user data from localStorage
    const userStr = localStorage.getItem("user")
    const token = localStorage.getItem("auth-token")
    
    if (!userStr || !token) {
      // Not logged in, redirect to login
      router.replace("/auth/login")
      return
    }

    try {
      const user = JSON.parse(userStr)
      setCurrentUser(user)
    } catch (e) {
      // Invalid user data
      localStorage.removeItem("user")
      localStorage.removeItem("auth-token")
      router.replace("/auth/login")
      return
    }

    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/notifications?unreadOnly=true", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.notifications?.length || 0)
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }

  const handleMarkAsRead = async (notificationId?: string) => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notificationId,
          markAllAsRead: !notificationId,
        }),
      })

      fetchNotifications()
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("auth-token")
    localStorage.removeItem("user")
    // Use replace to prevent going back to dashboard
    window.location.replace("/")
  }

  const getInitials = (name: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getSettingsUrl = () => {
    return `/dashboard/${userType}/settings`
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <Link href="/" className="flex items-center space-x-2 px-4 py-2">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">RentGuard</span>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            {navigation.map((group) => (
              <SidebarGroup key={group.title}>
                <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={pathname === item.url}>
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton>
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={currentUser?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser?.name || 'User'}`} />
                        <AvatarFallback>{getInitials(currentUser?.name || "User")}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{currentUser?.name || "User"}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                    <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={getSettingsUrl()}>
                        <User className="mr-2 h-4 w-4" />
                        {tCommon('profile')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={getSettingsUrl()}>
                        <Settings className="mr-2 h-4 w-4" />
                        {t('settings')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {tCommon('logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        {unreadCount}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>{t('notifications')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length > 0 ? (
                    <>
                      {notifications.slice(0, 5).map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="flex flex-col items-start p-3 cursor-pointer"
                          onClick={() => {
                            if (notification.link) {
                              window.location.href = notification.link
                            }
                            handleMarkAsRead(notification.id)
                          }}
                        >
                          <div className="font-medium">{notification.title}</div>
                          <div className="text-sm text-muted-foreground">{notification.message}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleMarkAsRead()}>
                        {t('markAllAsRead')}
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem disabled>{t('noNewNotifications')}</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {tCommon('logout')}
              </Button>
              <ModeToggle />
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
