"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, MapPin, Filter, Heart, Calendar, MessageSquare, UserCheck, CheckCircle } from "lucide-react"
import { PropertyCard } from "@/components/dashboard/property-card"
import { PaymentHistory } from "@/components/dashboard/payment-history"
import { MessageCenter } from "@/components/dashboard/message-center"
import { AIChat } from "@/components/dashboard/ai-chat"
import { getCurrencySymbol } from "@/lib/utils"


export default function TenantDashboard() {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tHero = useTranslations('hero')
  const tCommon = useTranslations('common')
  const tFooter = useTranslations('footer')
  const currencySymbol = getCurrencySymbol()
  const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
  const [searchQuery, setSearchQuery] = useState("")
  const [savedProperties, setSavedProperties] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [leases, setLeases] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [stats, setStats] = useState({
    savedCount: 0,
    applicationsCount: 0,
    viewingsCount: 0,
    unreadMessages: 0,
    activeLeases: 0,
    unreadNotifications: 0
  })
  const [userName, setUserName] = useState("")
  const [representedBy, setRepresentedBy] = useState<{name: string, id: string} | null>(null)
  const [activeTab, setActiveTab] = useState("ai-search")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const uniqueLeases = useMemo(() => {
    return leases.reduce((acc: any[], current) => {
      const existingIndex = acc.findIndex(item => item.propertyId === current.propertyId);
      if (existingIndex === -1) {
        return [...acc, current];
      }
      
      const existing = acc[existingIndex];
      // If current is ACTIVE and existing is not, replace existing
      if ((current.status === 'ACTIVE' || current.isActive) && !(existing.status === 'ACTIVE' || existing.isActive)) {
        const newAcc = [...acc];
        newAcc[existingIndex] = current;
        return newAcc;
      }
      return acc;
    }, []);
  }, [leases]);


  const renderAppStatus = (status?: string) => {
    const s = (status || '').toUpperCase()
    let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "default"
    let label = t('status')

    switch (s) {
      case 'APPROVED':
        variant = "success"
        label = t('approved')
        break
      case 'AGENT_APPROVED':
        variant = "warning"
        label = t('agentApproved') || "中介已通过"
        break
      case 'PENDING':
        variant = "secondary"
        label = t('pending')
        break
      case 'REJECTED':
        variant = "destructive"
        label = t('rejected')
        break
      case 'WITHDRAWN':
        variant = "outline"
        label = t('withdrawn')
        break
      case 'UNDER_REVIEW':
        variant = "secondary"
        label = t('underReview')
        break
      default:
        variant = "outline"
        label = status || (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '状态' : 'Status')
    }
    
    // Using a custom Badge wrapper or styling since "success" variant might not exist in standard shadcn Badge
    const getBadgeStyle = (v: string) => {
      switch(v) {
        case 'success': return "bg-green-500 hover:bg-green-600 border-transparent text-white"
        case 'warning': return "bg-yellow-500 hover:bg-yellow-600 border-transparent text-white" 
        case 'destructive': return "bg-red-500 hover:bg-red-600 border-transparent text-white"
        case 'secondary': return "bg-secondary hover:bg-secondary/80 border-transparent text-secondary-foreground"
        default: return "text-foreground"
      }
    }

    return (
      <Badge className={getBadgeStyle(variant)} variant={variant === 'success' || variant === 'warning' ? 'default' : variant as any}>
        {label}
      </Badge>
    )
  }

  const resolveImageUrl = (images: any) => {
    if (!images) return "/placeholder.svg"
    if (Array.isArray(images)) {
      return images[0] || "/placeholder.svg"
    }
    if (typeof images === "string") {
      try {
        const parsed = JSON.parse(images)
        if (Array.isArray(parsed) && parsed[0]) {
          return parsed[0]
        }
      } catch {}
      return images.startsWith("http") ? images : "/placeholder.svg"
    }
    return "/placeholder.svg"
  }

  // Fetch user data and stats
  const fetchData = async (showLoading = false) => {
    const token = localStorage.getItem("auth-token")
    if (!token) {
      router.push("/auth/login")
      return
    }

    // 只在首次加载时显示全屏加载，后续刷新不显示
    if (showLoading) {
      setLoading(true)
    }
    setError(null)

    try {
      // Get user info
      const userStr = localStorage.getItem("user")
      if (userStr) {
        const user = JSON.parse(userStr)
        setUserName(user.name || "User")
        
        // Fetch full profile to check representation
        const profileRes = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          if (profileData.user?.representedById) {
            // Fetch agent details
            const agentRes = await fetch(`/api/auth/user/${profileData.user.representedById}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (agentRes.ok) {
              const agentData = await agentRes.json()
              const agent = agentData?.user || agentData
              if (agent?.id) {
                setRepresentedBy({
                  name: agent.name,
                  id: agent.id
                })
              }
            }
          }
        }
      }

      // Fetch saved properties
      const savedRes = await fetch("/api/saved-properties", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (savedRes.ok) {
        const savedData = await savedRes.json()
        setSavedProperties(savedData.properties || [])
        setStats(prev => ({ ...prev, savedCount: savedData.properties?.length || 0 }))
      }

      // Fetch applications
      const appsRes = await fetch("/api/applications?userType=tenant", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (appsRes.ok) {
        const appsData = await appsRes.json()
        setApplications(appsData.applications || [])
        setStats(prev => ({ ...prev, applicationsCount: appsData.applications?.length || 0 }))
      }

      // Fetch Leases (Rentals)
      const leasesRes = await fetch("/api/tenant/leases", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (leasesRes.ok) {
        const leasesData = await leasesRes.json()
        setLeases(leasesData.leases || [])
        setStats(prev => ({ ...prev, activeLeases: leasesData.leases?.length || 0 }))
      }

      // Fetch Payments (for Check-in status)
      const paymentsRes = await fetch("/api/payments?userType=tenant", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        const fetchedPayments = paymentsData.payments || []
        console.log('Fetched payments:', fetchedPayments.length, fetchedPayments)
        setPayments(fetchedPayments)
      } else {
        console.error('Failed to fetch payments:', paymentsRes.status, await paymentsRes.text())
      }

      // Fetch Notifications
      const notifRes = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (notifRes.ok) {
        const notifData = await notifRes.json()
        setNotifications(notifData.notifications || [])
        setStats(prev => ({ ...prev, unreadNotifications: notifData.notifications?.filter((n: any) => !n.isRead).length || 0 }))
      }

      // Fetch unread messages count
      const messagesRes = await fetch("/api/messages/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (messagesRes.ok) {
        const messagesData = await messagesRes.json()
        setStats(prev => ({ ...prev, unreadMessages: messagesData.count || 0 }))
      }
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error)
      // 只在首次加载失败时显示错误，后续刷新失败不显示错误
      if (showLoading) {
        setError(error.message || "加载数据失败，请刷新页面重试")
      }
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  // Handle Confirm Check-in
  const handleCheckIn = async (leaseId: string) => {
    if (!confirm(t('confirmCheckIn') + "?")) return
    
    // Find payment for this lease - using robust matching logic similar to render
    const lease = leases.find(l => l.id === leaseId)
    const payment = payments.find(p => {
      // Method 1: Metadata leaseId match
      if (p.metadata && typeof p.metadata === 'object' && (p.metadata as any).leaseId === leaseId) return true
      // Method 2: Description match
      if (p.description && p.description.includes(leaseId)) return true
      // Method 3: Context match (Property + Status) - Fallback if metadata is missing
      if (lease && p.propertyId === lease.propertyId && p.type === 'RENT' && p.status === 'PENDING' && p.escrowStatus === 'HELD_IN_ESCROW') return true
      return false
    })
    
    if (!payment) {
      alert(t('noEscrowPaymentFound') || "未找到该租赁的托管支付订单。请联系房东或中介确认订单是否已生成。")
      return
    }

    try {
      const token = localStorage.getItem("auth-token")
      const res = await fetch(`/api/payments/${payment.id}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        alert(t('fundsReleased') || "确认入住成功！资金已释放。")
        fetchData()
      } else {
        const err = await res.json()
        // Handle specific error cases
        if (err.message && err.message.includes('Invalid escrow status')) {
          if (payment.escrowStatus === 'RELEASED') {
            alert("该订单资金已释放，无需重复确认。")
            fetchData()
            return
          }
        }
        alert(err.error || err.message || "Failed to confirm check-in")
      }
    } catch (e) {
      console.error(e)
      alert("Error confirming check-in")
    }
  }

  useEffect(() => {
    // 首次加载显示加载状态
    fetchData(true)
    // 后台静默刷新，不显示加载状态
    const interval = setInterval(() => {
      fetchData(false)
    }, 30000) // 改为30秒刷新一次，避免过于频繁
    return () => clearInterval(interval)
  }, [])
  
  // 检查URL参数，如果是支付成功，刷新数据并切换到支付标签
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab) {
        setActiveTab(tab)
      }
      if (params.get('success') === 'true' || tab === 'payments') {
        // 切换到支付标签
        setActiveTab('payments')
        // 刷新支付数据
        fetchData(false)
        // 延迟再次刷新，确保状态更新
        setTimeout(() => {
          fetchData(false)
        }, 2000)
        // 清除URL参数
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [])

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <DashboardLayout userType="tenant">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">{tCommon('loading') || "加载中..."}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <DashboardLayout userType="tenant">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => {
              setError(null)
              fetchData()
            }}>
              {tCommon('retry') || "重试"}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">{t('welcome')} {userName || tCommon('user')}!</h1>
          <p className="text-muted-foreground">{t('findIdealHome') || "Find your ideal home with secure deposit protection."}</p>
          {representedBy && (
            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
              <span>
                {process.env.NEXT_PUBLIC_APP_REGION === 'china' 
                  ? `您的专属中介: ${representedBy.name}`
                  : `Your Agent: ${representedBy.name}`}
              </span>
            </div>
          )}
        </div>

        {/* Representation Status */}
        {representedBy && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg flex items-center justify-between border border-primary/20">
            <div className="flex items-center space-x-3">
              <UserCheck className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold text-primary">{t('youAreRepresentedBy')} {representedBy.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('agentRepresentsYouDesc') || "This agent handles your property search and negotiations."}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => router.push(`/dashboard/tenant/messages?userId=${representedBy.id}`)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              {t('messages')}
            </Button>
          </div>
        )}

        {/* Notifications Area */}
        {notifications.length > 0 && (
           <div className="mb-6 space-y-2">
             <h3 className="text-lg font-semibold">{t('notifications')}</h3>
             {notifications.map((notif: any) => {
               // 国内版：将英文通知标题和内容转换为中文
               const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
               const isChina = region === 'china'
               
               let displayTitle = notif.title
               let displayMessage = notif.message
               
               if (isChina) {
                 // 转换常见通知标题
                 if (notif.title === 'New Agent Representation' || notif.title?.includes('Agent Representation')) {
                   displayTitle = '新中介代理'
                 } else if (notif.title === 'Application Approved') {
                   displayTitle = '申请已批准'
                 } else if (notif.title === 'Funds Released') {
                   displayTitle = '资金已释放'
                 }
                 
                 // 转换常见通知消息
                 if (notif.message?.includes('You are now represented by an agent')) {
                   displayMessage = '您现在由中介代理。该中介将处理您的房源搜索和谈判。'
                 } else if (notif.message?.includes('represented by')) {
                   displayMessage = displayMessage.replace(/You are now represented by an agent\./g, '您现在由中介代理。')
                     .replace(/This agent handles your property search and negotiations\./g, '该中介将处理您的房源搜索和谈判。')
                 }
               }
               
               return (
                 <div key={notif.id} className={`p-4 rounded-lg border flex justify-between items-center ${notif.isRead ? 'bg-background' : 'bg-muted/30'}`}>
                   <div>
                     <p className="font-medium">{displayTitle}</p>
                     <p className="text-sm text-muted-foreground">{displayMessage}</p>
                     <p className="text-xs text-muted-foreground mt-1">{new Date(notif.createdAt).toLocaleDateString()}</p>
                   </div>
                   {!notif.isRead && (
                      <Badge variant="secondary">{t('unread')}</Badge>
                   )}
                 </div>
               )
             })}
           </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">{t('searchProperties') || "Search Properties"}</div>
                  <div className="text-sm text-muted-foreground">{t('findNextHome') || "Find your next home"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Heart className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">{t('savedProperties')}</div>
                  <div className="text-sm text-muted-foreground">{stats.savedCount} {t('saved') || "saved"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">{t('viewings') || "Viewings"}</div>
                  <div className="text-sm text-muted-foreground">{stats.viewingsCount} {t('scheduled') || "scheduled"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">{t('messages')}</div>
                  <div className="text-sm text-muted-foreground">{stats.unreadMessages} {t('unread') || "unread"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="ai-search">
              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? 'AI智能搜索' : t('aiSmartSearch')}
            </TabsTrigger>
            <TabsTrigger value="search">
              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '搜索' : t('search')}
            </TabsTrigger>
            <TabsTrigger value="rentals">
              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '我的租赁' : tFooter('myRentals')}
            </TabsTrigger>
            <TabsTrigger value="saved">
              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '收藏的房源' : t('savedProperties')}
            </TabsTrigger>
            <TabsTrigger value="applications">
              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '申请记录' : t('applications')}
            </TabsTrigger>
            <TabsTrigger value="payments">
              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '支付记录' : t('payments')}
            </TabsTrigger>
            <TabsTrigger value="messages">
              {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '消息' : t('messages')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-search" className="space-y-6">
            <AIChat userType="tenant" />
          </TabsContent>

          <TabsContent value="rentals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '我的租赁' : tFooter('myRentals')}
                </CardTitle>
                <CardDescription>
                  {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '跟踪您的租金支付和押金状态' : t('trackRentPayments')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leases.length > 0 ? (
                  <div className="space-y-4">
                    {uniqueLeases.map((lease) => {
                       // Check for escrow payment - 通过多种方式匹配
                       const escrowPayment = payments.find(p => {
                         // 方法1: 通过metadata中的leaseId匹配
                         if (p.metadata && typeof p.metadata === 'object' && (p.metadata as any).leaseId === lease.id) {
                           return true
                         }
                         // 方法2: 通过description匹配
                         if (p.description && p.description.includes(lease.id)) {
                           return true
                         }
                         // 方法3: 通过propertyId和状态匹配
                         if (p.propertyId === lease.propertyId && p.type === 'RENT' && p.status === 'PENDING' && p.escrowStatus === 'HELD_IN_ESCROW') {
                           return true
                         }
                         return false
                       });
                       const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
                       // 判断租赁状态
                       const leaseStatus = lease.status || (lease.isActive ? 'ACTIVE' : 'PENDING_PAYMENT')
                       const isActive = leaseStatus === 'ACTIVE' || lease.isActive
                       return (
                        <div key={lease.id} className="p-4 border rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex-1">
                            <div className="font-semibold text-lg">{lease.property?.title || (isChina ? "房源" : "Property")}</div>
                            <div className="text-sm text-muted-foreground">{lease.property?.address || lease.propertyId}</div>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span>{isChina ? '开始日期' : 'Start'}: {new Date(lease.startDate).toLocaleDateString()}</span>
                              <span>{isChina ? '结束日期' : 'End'}: {new Date(lease.endDate).toLocaleDateString()}</span>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <Badge variant={isActive ? "default" : "secondary"}>
                                {isActive ? (isChina ? "进行中" : "Active") : (leaseStatus === 'PENDING_PAYMENT' ? (isChina ? "待支付" : "Pending Payment") : (isChina ? "已结束" : "Inactive"))}
                              </Badge>
                              {escrowPayment && (
                                <Badge variant="outline" className="text-amber-600 border-amber-600">
                                  {isChina ? "待支付" : "Pending Payment"}
                                </Badge>
                              )}
                            </div>
                            {escrowPayment && (
                              <div className="mt-2 text-sm">
                                <span className="text-muted-foreground">{isChina ? "待支付金额" : "Pending Amount"}: </span>
                                <span className="font-semibold">{getCurrencySymbol()}{escrowPayment.amount.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-2 items-end">
                            {escrowPayment && (
                              <div className="text-right">
                                <div className="text-sm font-medium text-amber-600 mb-1">
                                  {isChina 
                                    ? (escrowPayment.escrowStatus === 'RELEASED' ? "资金已释放" : "资金托管中") 
                                    : (escrowPayment.escrowStatus === 'RELEASED' ? "Funds Released" : (t('fundsHeldInEscrow') || "Funds Held in Escrow"))}
                                </div>
                                {escrowPayment.status === 'PENDING' ? (
                                  <Button onClick={() => setActiveTab('payments')} className="w-full md:w-auto">
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    {isChina ? "去支付" : "Pay Now"}
                                  </Button>
                                ) : escrowPayment.escrowStatus === 'HELD_IN_ESCROW' ? (
                                  <Button onClick={() => handleCheckIn(lease.id)} className="w-full md:w-auto">
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    {isChina ? "确认入住" : t('confirmCheckIn')}
                                  </Button>
                                ) : (
                                  <Button disabled variant="outline" className="w-full md:w-auto">
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    {isChina ? "已确认入住" : "Check-in Confirmed"}
                                  </Button>
                                )}
                              </div>
                            )}
                            <Button variant="outline" size="sm" onClick={() => window.location.href=`/properties/${lease.propertyId}`}>
                              {isChina ? "查看详情" : tCommon('viewDetails')}
                            </Button>
                          </div>
                        </div>
                       )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? "暂无租赁记录。" : (t('noActiveTenants') || "No active rentals.")}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            {/* Search Bar */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={tHero('searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    {tCommon('filter') || "Filters"}
                  </Button>
                  <Button
                    onClick={async () => {
                    if (!searchQuery.trim()) {
                      alert(tCommon('error') || "Please enter search content")
                      return
                    }
                    const token = localStorage.getItem("auth-token")
                    setSearchLoading(true)
                    setHasSearched(true)
                    try {
                      const response = await fetch(`/api/properties/search?q=${encodeURIComponent(searchQuery)}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                      })
                      const data = await response.json()
                      if (response.ok && data.properties) {
                        setSearchResults(data.properties.map((p: any) => ({
                          id: p.id,
                          title: p.title,
                          location: [p.city, p.state].filter(Boolean).join(", "),
                          price: p.price,
                          beds: p.bedrooms,
                          baths: p.bathrooms,
                          sqft: p.sqft || 0,
                          image: resolveImageUrl(p.images),
                          status: 'available',
                        })))
                      } else {
                        setSearchResults([])
                        alert(data.error || "Search failed, please try again later")
                      }
                    } catch (err) {
                      setSearchResults([])
                      console.error(err)
                      alert("Search failed, please try again later")
                    } finally {
                      setSearchLoading(false)
                    }
                  }}
                  disabled={searchLoading}
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {searchLoading ? (tCommon('loading') || "Loading...") : (isChina ? "搜索" : "Search")}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">
                    {hasSearched
                      ? (t('noPropertiesFound') || "No properties found")
                      : (t('enterSearchCriteria') || "Enter search criteria and click search to find properties")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="saved" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('savedProperties')}</CardTitle>
                <CardDescription>{t('savedPropertiesDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {savedProperties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {savedProperties.map((property) => (
                      <PropertyCard key={property.id} property={property} showSaveButton={false} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">{t('noSavedProperties')}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('rentalApplications') || t('applications')}</CardTitle>
                <CardDescription>{t('trackApplicationStatus')}</CardDescription>
              </CardHeader>
              <CardContent>
                {applications.length > 0 ? (
                  <div className="space-y-4">
                    {applications.map((application) => (
                      <div key={application.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-semibold">{application.property?.title || t('property')}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('appliedOn')} {new Date(application.appliedDate).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('deposit')}: {currencySymbol}{application.depositAmount?.toLocaleString() || 0}
                          </div>
                        </div>
                        <div className="text-right">
                          {renderAppStatus(application.status)}
                          <div className="mt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.location.href = `/properties/${application.propertyId}`}
                            >
                              {tCommon('viewDetails') || tCommon('view')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">{t('noApplicationsYet')}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <PaymentHistory userType="tenant" />
          </TabsContent>

          <TabsContent value="messages">
            <MessageCenter />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
