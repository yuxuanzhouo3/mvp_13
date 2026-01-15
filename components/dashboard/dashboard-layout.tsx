"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
} from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
  userType: "tenant" | "landlord" | "admin"
}

const navigationItems = {
  tenant: [
    {
      title: "Search",
      items: [
        { title: "Find Properties", url: "/dashboard/tenant", icon: Search },
        { title: "Saved Properties", url: "/dashboard/tenant/saved", icon: Heart },
        { title: "Applications", url: "/dashboard/tenant/applications", icon: FileText },
      ],
    },
    {
      title: "Account",
      items: [
        { title: "Payments", url: "/dashboard/tenant/payments", icon: CreditCard },
        { title: "Messages", url: "/dashboard/tenant/messages", icon: MessageSquare },
        { title: "Settings", url: "/dashboard/tenant/settings", icon: Settings },
      ],
    },
  ],
  landlord: [
    {
      title: "Properties",
      items: [
        { title: "Dashboard", url: "/dashboard/landlord", icon: Home },
        { title: "Add Property", url: "/dashboard/landlord/add-property", icon: Plus },
        { title: "Applications", url: "/dashboard/landlord/applications", icon: FileText },
        { title: "Tenants", url: "/dashboard/landlord/tenants", icon: Users },
      ],
    },
    {
      title: "Business",
      items: [
        { title: "Payments", url: "/dashboard/landlord/payments", icon: CreditCard },
        { title: "Analytics", url: "/dashboard/landlord/analytics", icon: BarChart3 },
        { title: "Messages", url: "/dashboard/landlord/messages", icon: MessageSquare },
        { title: "Settings", url: "/dashboard/landlord/settings", icon: Settings },
      ],
    },
  ],
  admin: [
    {
      title: "Management",
      items: [
        { title: "Dashboard", url: "/dashboard/admin", icon: BarChart3 },
        { title: "Users", url: "/dashboard/admin/users", icon: Users },
        { title: "Properties", url: "/dashboard/admin/properties", icon: Home },
        { title: "Disputes", url: "/dashboard/admin/disputes", icon: Gavel },
      ],
    },
    {
      title: "System",
      items: [
        { title: "Analytics", url: "/dashboard/admin/analytics", icon: BarChart3 },
        { title: "Settings", url: "/dashboard/admin/settings", icon: Settings },
      ],
    },
  ],
}

export function DashboardLayout({ children, userType }: DashboardLayoutProps) {
  const pathname = usePathname()
  const navigation = navigationItems[userType]

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
                        <AvatarImage src="/placeholder.svg?height=24&width=24" />
                        <AvatarFallback>SJ</AvatarFallback>
                      </Avatar>
                      <span>Sarah Johnson</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" className="w-[--radix-popper-anchor-width]">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
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
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  3
                </Badge>
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
