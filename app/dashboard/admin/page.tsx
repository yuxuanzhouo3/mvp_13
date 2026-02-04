"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Users, DollarSign, TrendingUp, Globe, MapPin } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface StatsData {
  region?: string
  period?: string
  users?: {
    total: number
    active: {
      daily: number
      monthly: number
      total: number
    }
  }
  revenue?: {
    daily: number
    monthly: number
    total: number
    currency: string
  }
  subscriptions?: {
    daily: number
    monthly: number
    total: number
    byTier: Record<string, number>
  }
  devices?: Record<string, number>
}

interface CombinedStats {
  global?: StatsData
  china?: StatsData
  total?: {
    users: number
    revenue: number
    subscriptions: number
    devices: Record<string, number>
  }
}

export default function AdminDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<CombinedStats | null>(null)
  const [region, setRegion] = useState<'all' | 'global' | 'china'>('all')
  const [period, setPeriod] = useState<'day' | 'month' | 'all'>('day')

  useEffect(() => {
    // 检查是否已登录（优先检查管理员 token）
    const adminToken = localStorage.getItem('admin-token')
    const userToken = localStorage.getItem('auth-token')
    
    if (!adminToken && !userToken) {
      router.push('/admin/login')
      return
    }

    // 如果有管理员 token，使用管理员 token
    // 否则使用普通用户 token（需要是管理员用户）
    loadStats()
  }, [region, period])

  const loadStats = async () => {
    try {
      setLoading(true)
      // 优先使用管理员 token，否则使用普通用户 token
      const adminToken = localStorage.getItem('admin-token')
      const userToken = localStorage.getItem('auth-token')
      const token = adminToken || userToken
      
      const url = new URL('/api/admin/stats', window.location.origin)
      if (region !== 'all') {
        url.searchParams.set('region', region)
      }
      url.searchParams.set('period', period)

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "无权限访问",
            description: "您不是管理员，无法访问后台系统",
            variant: "destructive",
          })
          router.push('/dashboard/tenant')
          return
        }
        throw new Error('获取统计数据失败')
      }

      const data = await response.json()
      setStats(data)
    } catch (error: any) {
      toast({
        title: "加载失败",
        description: error.message || "无法加载统计数据",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">加载中...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">后台管理系统</h1>
          <p className="text-muted-foreground">数据统计与分析</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={region === 'all' ? 'default' : 'outline'}
            onClick={() => setRegion('all')}
          >
            全部
          </Button>
          <Button
            variant={region === 'global' ? 'default' : 'outline'}
            onClick={() => setRegion('global')}
          >
            国际版
          </Button>
          <Button
            variant={region === 'china' ? 'default' : 'outline'}
            onClick={() => setRegion('china')}
          >
            国内版
          </Button>
        </div>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList>
          <TabsTrigger value="day">今日</TabsTrigger>
          <TabsTrigger value="month">本月</TabsTrigger>
          <TabsTrigger value="all">全部</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-4">
          {region === 'all' && stats?.total ? (
            // 显示汇总数据
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总用户数</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total.users}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总收入</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${stats.total.revenue.toFixed(2)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总订阅数</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total.subscriptions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">设备统计</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {Object.entries(stats.total.devices || {}).map(([device, count]) => (
                      <div key={device} className="flex justify-between">
                        <span>{device}:</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            // 显示单个区域数据
            stats && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">总用户数</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.users?.total || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      日活跃: {stats.users?.active.daily || 0} | 月活跃: {stats.users?.active.monthly || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">收入</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {stats.revenue?.currency === 'CNY' ? '¥' : '$'}
                      {stats.revenue?.total.toFixed(2) || '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      今日: {stats.revenue?.daily || 0} | 本月: {stats.revenue?.monthly || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">订阅数</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.subscriptions?.total || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      今日: {stats.subscriptions?.daily || 0} | 本月: {stats.subscriptions?.monthly || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">订阅分布</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      {Object.entries(stats.subscriptions?.byTier || {}).map(([tier, count]) => (
                        <div key={tier} className="flex justify-between">
                          <span>{tier}:</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          )}

          {region === 'all' && stats?.global && stats?.china && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    国际版数据
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>用户: {stats.global.users?.total || 0}</div>
                  <div>收入: ${stats.global.revenue?.total.toFixed(2) || '0.00'}</div>
                  <div>订阅: {stats.global.subscriptions?.total || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    国内版数据
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>用户: {stats.china.users?.total || 0}</div>
                  <div>收入: ¥{stats.china.revenue?.total.toFixed(2) || '0.00'}</div>
                  <div>订阅: {stats.china.subscriptions?.total || 0}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
