"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts"
import { useTranslations } from 'next-intl'

interface AnalyticsChartsProps {
  revenueData: {
    name: string
    total: number
  }[]
  propertyStatusData: {
    name: string
    value: number
    color: string
  }[]
  currencySymbol: string
}

export function AnalyticsCharts({ revenueData, propertyStatusData, currencySymbol }: AnalyticsChartsProps) {
  const t = useTranslations('dashboard')
  
  // Custom Tooltip for Revenue Chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded p-2 shadow-sm text-sm">
          <p className="font-medium">{label}</p>
          <p className="text-primary">
            {t('revenue')}: {currencySymbol}{payload[0].value.toLocaleString()}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Revenue Trend Chart */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>{t('revenueTrend') || "Revenue Trend"}</CardTitle>
          <CardDescription>
            {t('revenueTrendDesc') || "Monthly revenue for the past 6 months"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${currencySymbol}${value}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar 
                  dataKey="total" 
                  fill="currentColor" 
                  radius={[4, 4, 0, 0]} 
                  className="fill-primary" 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Property Status Chart */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>{t('propertyStatus') || "Property Status"}</CardTitle>
          <CardDescription>
            {t('propertyStatusDesc') || "Distribution of property occupancy"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            {propertyStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={propertyStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {propertyStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                     formatter={(value: number) => [value, t('properties')]}
                     contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center justify-center h-full">
                <p>{t('noPropertyData') || "No property data available"}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
