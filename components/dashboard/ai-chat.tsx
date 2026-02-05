"use client"

import { useState } from "react"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PropertyCard } from "./property-card"
import { getCurrencySymbol } from "@/lib/utils"

interface AIChatProps {
  userType: "tenant" | "landlord"
}

export function AIChat({ userType }: AIChatProps) {
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')
  const tSearch = useTranslations('search')
  const currencySymbol = getCurrencySymbol()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [history, setHistory] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) {
      toast({
        title: tCommon('error'),
        description: tCommon('error') || "Please enter search query",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        toast({
          title: tAuth('loginFailed'),
          description: tAuth('loginFailed') || "AI search requires login",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query,
          userType: userType.toUpperCase(),
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setResults(data)
        setHistory([...history, query])
        setQuery("")
        toast({
          title: tCommon('success'),
          description: data.message || tCommon('success'),
        })
      } else {
        throw new Error(data.error || tCommon('error'))
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

  // 根据环境变量决定显示国内版还是国际版的推荐问题
  // 在客户端组件中，通过检查当前语言环境来判断
  const currentLocale = typeof window !== 'undefined' 
    ? (document.documentElement.lang || 'en')
    : 'en'
  // 检查环境变量（在客户端，NEXT_PUBLIC_ 前缀的变量会被注入到客户端）
  const appRegion = typeof window !== 'undefined' 
    ? ((window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_APP_REGION || (process.env as any).NEXT_PUBLIC_APP_REGION || 'global')
    : 'global'
  const isChina = appRegion === 'china' || currentLocale === 'zh' || currentLocale === 'zh-CN'
  
  const exampleQueries = userType === "tenant" 
    ? (isChina ? [
        // 国内版租客推荐问题
        "我是刚毕业的年轻人，想在大学附近或者热门商圈找个住处。预算1万以内，最好是拎包入住的公寓或者适合合租的联排，交通便利是首选。",
        "我想找一套2万左右的高端房子，最好是市中心的高层或者海景房。要求装修现代，2室以上，如果有健身房或者管家服务就更好了。",
        "我在深圳工作，想给一家人找个3室的大房子。预算3万以内，希望能带个私家花园或者大活动空间，方便孩子玩耍，还要有独立车库。",
      ] : [
        // 国际版租客推荐问题
        t('exampleQuery1') || "I need a property within 3km, price $2000-$2500, lease 6 months or longer",
        t('exampleQuery2') || "Find a 2-bedroom 1-bathroom apartment in Seattle that allows pets",
        t('exampleQuery3') || "I need a property in Seattle, monthly rent $2000-$3000, lease at least 12 months",
      ])
    : (isChina ? [
        "我是刚毕业的年轻人，想在大学附近或者热门商圈找个住处。预算1万以内，最好是拎包入住的公寓或者适合合租的联排，交通便利是首选。",
        "我想找一套2万左右的高端房子，最好是市中心的高层或者海景房。要求装修现代，2室以上，如果有健身房或者管家服务就更好了。",
        "我在深圳工作，想给一家人找个3室的大房子。预算3万以内，希望能带个私家花园或者大活动空间，方便孩子玩耍，还要有独立车库。",
      ] : [
        // 国际版房东推荐问题
        t('landlordExampleQuery1') || "I need tenants who can lease for 6+ months with rent up to $3000",
        t('landlordExampleQuery2') || "Find tenants with credit score above 700, monthly income at least $5000",
        t('landlordExampleQuery3') || "I need tenants for 12-month lease, rent $2500-$3000",
      ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>{t('aiSmartSearch')}</span>
          </CardTitle>
          <CardDescription>
            {userType === "tenant" 
              ? (t('aiSmartSearch') + " - " + (t('findIdealHome') || t('search')))
              : (t('aiSmartSearch') + " - " + (t('manageTenantRelationships') || t('search')))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={
                  isChina
                    ? "我是刚毕业的年轻人，想在大学附近或者热门商圈找个住处。预算1万以内，最好是拎包入住的公寓或者适合合租的联排，交通便利是首选。"
                    : (userType === "tenant"
                      ? (t('exampleQuery1') || "I need a property within 3km, price $2000-$2500, lease 6 months or longer")
                      : (t('landlordExampleQuery1') || "I need tenants who can lease for 6+ months with rent up to $3000"))
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>

          {/* Example Queries */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('search')}</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery(example)}
                  disabled={loading}
                  className="text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>{t('search') || "Search Results"}</CardTitle>
            <CardDescription>{results.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.results && results.results.length > 0 ? (
              results.results.map((result: any, index: number) => (
                <div key={index} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{result.platform}</h3>
                    <span className="text-sm text-muted-foreground">
                      {result.totalCount} results
                    </span>
                  </div>
                  
                  {userType === "tenant" && result.properties && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {result.properties.slice(0, 6).map((property: any) => (
                        <PropertyCard
                          key={property.id}
                          property={{
                            id: property.id,
                            title: property.title,
                            location: `${property.city}, ${property.state}`,
                            price: property.price,
                            beds: property.bedrooms,
                            baths: property.bathrooms,
                            sqft: property.sqft || 0,
                            image: property.image || "/placeholder.svg",
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {userType === "landlord" && result.results && (
                    <div className="space-y-2">
                      {result.results.slice(0, 5).map((tenant: any, idx: number) => (
                        <Card key={idx}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-semibold">{tenant.name || `Tenant ${idx + 1}`}</h4>
                                <p className="text-sm text-muted-foreground">{tenant.email}</p>
                    {tenant.monthlyIncome && (
                      <p className="text-sm">{t('monthlyIncome')}: {currencySymbol}{tenant.monthlyIncome.toLocaleString()}</p>
                    )}
                    {tenant.creditScore && (
                      <p className="text-sm">{t('creditScore')}: {tenant.creditScore}</p>
                    )}
                              </div>
                              <Button size="sm" variant="outline">
                    {t('viewDetails')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {tSearch('noPropertiesFound') || "No search results found. Please try a different query."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('search') || "Search History"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((item, index) => (
                <Button
                  key={index}
                  variant="ghost"
                   className="w-full justify-start text-left"
                  onClick={() => setQuery(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
