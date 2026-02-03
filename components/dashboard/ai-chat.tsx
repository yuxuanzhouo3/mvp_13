"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MessageSquare, Send, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PropertyCard } from "./property-card"

interface AIChatProps {
  userType: "tenant" | "landlord"
}

export function AIChat({ userType }: AIChatProps) {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [history, setHistory] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) {
      toast({
        title: "Please enter search query",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        toast({
          title: "Please Login",
          description: "AI search requires login",
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
          title: "Search Successful",
          description: data.message || "Found matching results",
        })
      } else {
        throw new Error(data.error || "搜索失败")
      }
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const exampleQueries = userType === "tenant" 
    ? [
        "I need a property within 3km, price $2000-$2500, lease 6 months or longer",
        "Find a 2-bedroom 1-bathroom apartment in Seattle that allows pets",
        "I need a property in Seattle, monthly rent $2000-$3000, lease at least 12 months",
      ]
    : [
        "I need tenants who can lease for 6+ months with rent up to $3000",
        "Find tenants with credit score above 700, monthly income at least $5000",
        "I need tenants for 12-month lease, rent $2500-$3000",
      ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span>AI Smart Search</span>
          </CardTitle>
          <CardDescription>
            {userType === "tenant" 
              ? "Describe your ideal property in natural language, and AI will help you find matching listings"
              : "Describe your ideal tenant in natural language, and AI will help you find matching applicants"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={
                  userType === "tenant"
                    ? "e.g., I need a property within 3km, price $2000-$2500, lease 6 months or longer"
                    : "e.g., I need tenants who can lease for 6+ months with rent up to $3000"
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
            <p className="text-sm text-muted-foreground">Example Queries:</p>
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
            <CardTitle>Search Results</CardTitle>
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
                                  <p className="text-sm">Monthly Income: ${tenant.monthlyIncome.toLocaleString()}</p>
                                )}
                                {tenant.creditScore && (
                                  <p className="text-sm">Credit Score: {tenant.creditScore}</p>
                                )}
                              </div>
                              <Button size="sm" variant="outline">
                                View Details
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
                No search results found. Please try a different query.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search History</CardTitle>
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
