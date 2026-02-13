/**
 * AI服务 - 用于解析用户自然语言查询并提取搜索条件
 */

export interface ParsedSearchCriteria {
  maxPrice?: number
  minPrice?: number
  maxDistance?: number // 公里数
  minBedrooms?: number
  minBathrooms?: number
  city?: string
  state?: string
  minLeaseDuration?: number // 月数
  petFriendly?: boolean
  amenities?: string[]
  propertyType?: string
  query?: string
}

export interface ParsedTenantSearchCriteria extends ParsedSearchCriteria {
  // 租客特定字段
}

export interface ParsedLandlordSearchCriteria {
  minRent?: number
  maxRent?: number
  minLeaseDuration?: number
  requiredIncome?: number
  minCreditScore?: number
  city?: string
  state?: string
}

/**
 * 解析租客的自然语言查询
 */
export async function parseTenantQuery(query: string): Promise<ParsedTenantSearchCriteria> {
  // 这里应该调用OpenAI API来解析自然语言
  // 为了演示，我们使用规则匹配，实际应该使用AI模型
  
  const criteria: ParsedTenantSearchCriteria = {}
  
  // 价格范围提取 - 支持英文和中文
  const priceMatch = query.match(/(\d+)\s*[-~到至]\s*(\d+)\s*(?:美元|元|USD|\$|dollar)/i) ||
                     query.match(/价格\s*(\d+)\s*[-~到至]\s*(\d+)/i) ||
                     query.match(/(?:under|below|less than|maximum|max|up to)\s*\$?\s*(\d+)/i) ||
                     query.match(/\$?\s*(\d+)\s*[-~to]\s*\$?\s*(\d+)/i)
  if (priceMatch) {
    if (priceMatch[2]) {
      criteria.minPrice = parseFloat(priceMatch[1])
      criteria.maxPrice = parseFloat(priceMatch[2])
    } else {
      criteria.maxPrice = parseFloat(priceMatch[1])
    }
  } else {
    const singlePrice = query.match(/(?:价格|租金|房租|price|rent)\s*(?:低于|少于|不超过|最多|under|below|less than|maximum|max|up to)?\s*\$?\s*(\d+)/i)
    if (singlePrice) {
      criteria.maxPrice = parseFloat(singlePrice[1])
    }
  }

  // 距离提取
  const distanceMatch = query.match(/(\d+)\s*(?:公里|km|千米|英里|mile|miles)/i)
  if (distanceMatch) {
    criteria.maxDistance = parseFloat(distanceMatch[1])
  }

  // 租期提取
  const leaseMatch = query.match(/(\d+)\s*(?:个月|月|月以上|month|months)/i)
  if (leaseMatch) {
    criteria.minLeaseDuration = parseInt(leaseMatch[1])
  }

  // 城市提取 - 支持英文和中文
  const cityMatch = query.match(/(?:in|at|located in|city of|城市|位于|在)\s*([\u4e00-\u9fa5]{2,}|[A-Za-z][A-Za-z\s]+?)(?:\s|$|,|\.)/i) ||
                    query.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:apartment|house|condo|studio|property)/i)
  if (cityMatch) {
    criteria.city = cityMatch[1].trim()
  }

  // 房间数提取 - 支持英文和中文
  const bedroomMatch = query.match(/(\d+)\s*(?:室|bedroom|bed|bedrooms|房间|br|beds)/i) ||
                       query.match(/(\d+)\s*bed/i)
  if (bedroomMatch) {
    criteria.minBedrooms = parseInt(bedroomMatch[1])
  }

  // 浴室数提取
  const bathroomMatch = query.match(/(\d+)\s*(?:bathroom|bath|baths|bathrooms|卫|卫生间)/i)
  if (bathroomMatch) {
    criteria.minBathrooms = parseFloat(bathroomMatch[1])
  }

  // 宠物友好
  if (query.match(/宠物|pet|pets|pet friendly|pet-friendly/i)) {
    criteria.petFriendly = true
  }

  // 如果有Mistral API Key，使用AI解析
  if (process.env.MISTRAL_API_KEY) {
    try {
      const aiParsed = await parseWithMistral(query, 'tenant')
      return { ...criteria, ...aiParsed }
    } catch (error) {
      console.error('Mistral parsing failed, using rule-based:', error)
    }
  }

  return criteria
}

/**
 * 解析房东的自然语言查询
 */
export async function parseLandlordQuery(query: string): Promise<ParsedLandlordSearchCriteria> {
  const criteria: ParsedLandlordSearchCriteria = {}
  
  // 租金范围提取
  const rentMatch = query.match(/(\d+)\s*[-~到至]\s*(\d+)\s*(?:美元|元|USD|\$)/i)
  if (rentMatch) {
    criteria.minRent = parseFloat(rentMatch[1])
    criteria.maxRent = parseFloat(rentMatch[2])
  }

  // 租期提取
  const leaseMatch = query.match(/(\d+)\s*(?:个月|月|月以上|month)/i)
  if (leaseMatch) {
    criteria.minLeaseDuration = parseInt(leaseMatch[1])
  }

  // 收入要求
  const incomeMatch = query.match(/(?:收入|income)\s*(?:至少|不低于|最少)?\s*(\d+)/i)
  if (incomeMatch) {
    criteria.requiredIncome = parseFloat(incomeMatch[1])
  }

  // 信用分数
  const creditMatch = query.match(/(?:信用|credit)\s*(?:分数|score)?\s*(?:至少|不低于|最少)?\s*(\d+)/i)
  if (creditMatch) {
    criteria.minCreditScore = parseInt(creditMatch[1])
  }

  // 如果有Mistral API Key，使用AI解析
  if (process.env.MISTRAL_API_KEY) {
    try {
      const aiParsed = await parseWithMistral(query, 'landlord')
      return { ...criteria, ...aiParsed }
    } catch (error) {
      console.error('Mistral parsing failed, using rule-based:', error)
    }
  }

  return criteria
}

/**
 * 使用Mistral AI解析自然语言查询
 */
async function parseWithMistral(query: string, type: 'tenant' | 'landlord'): Promise<any> {
  if (!process.env.MISTRAL_API_KEY) {
    return {}
  }
  
  try {
    const systemPrompt = type === 'tenant' 
    ? `You are a rental property search assistant. Extract the following information from the user's natural language query:
- Price range (minPrice, maxPrice)
- Distance range (maxDistance, unit: kilometers)
- Minimum lease duration (minLeaseDuration, unit: months)
- City (city)
- State/Province (state)
- Minimum bedrooms (minBedrooms)
- Minimum bathrooms (minBathrooms)
- Pet friendly (petFriendly, boolean)
- Amenities requirements (amenities array)

Return JSON format, only include conditions explicitly mentioned by the user.`
    : `You are a tenant search assistant. Extract the following information from the landlord's natural language query:
- Rent range (minRent, maxRent)
- Minimum lease duration (minLeaseDuration, unit: months)
- Required minimum income (requiredIncome)
- Minimum credit score (minCreditScore)
- City (city)
- State/Province (state)

Return JSON format, only include conditions explicitly mentioned by the user.`

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    })

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (content) {
      return JSON.parse(content)
    }

    return {}
  } catch (error) {
    console.error('Mistral API error:', error)
    return {}
  }
}
