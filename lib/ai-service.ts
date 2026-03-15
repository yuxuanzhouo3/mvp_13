/**
 * AI服务 - 用于解析用户自然语言查询并提取搜索条件
 */

export interface ParsedSearchCriteria {
  maxPrice?: number
  minPrice?: number
  maxDistance?: number // 公里数
  minBedrooms?: number
  exactBedrooms?: number
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
  const chineseNumberMap: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  }
  const parseChineseNumber = (value: string) => {
    if (!value) return null
    if (value === '十') return 10
    if (value.includes('十')) {
      const [tensChar, onesChar] = value.split('十')
      const tens = tensChar ? chineseNumberMap[tensChar] : 1
      const ones = onesChar ? chineseNumberMap[onesChar] : 0
      if (!tens && tens !== 0) return null
      if (onesChar && ones === undefined) return null
      return tens * 10 + ones
    }
    return chineseNumberMap[value] ?? null
  }
  
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
  const enLocationMatch = query.match(/(?:in|at|located in)\s*([A-Za-z][A-Za-z\s]+)\s*,\s*([A-Za-z]{2,})/i) ||
    query.match(/([A-Za-z][A-Za-z\s]+)\s*,\s*([A-Za-z]{2,})/i)
  if (enLocationMatch) {
    criteria.city = enLocationMatch[1].trim()
    criteria.state = enLocationMatch[2].trim()
  }
  const cnLocationMatch = query.match(/(?:在|位于|位於|城市|地区|地區|区域|區域|靠近|附近)\s*([\u4e00-\u9fa5]{2,}(?:省|市|自治区|特别行政区)?)\s*([\u4e00-\u9fa5]{2,}(?:市|区|县|旗))?/i) ||
    query.match(/([\u4e00-\u9fa5]{2,}(?:省|市|自治区|特别行政区))\s*([\u4e00-\u9fa5]{2,}(?:市|区|县|旗))?/i)
  if (cnLocationMatch) {
    const cityValue = cnLocationMatch[1]?.trim()
    const stateValue = cnLocationMatch[2]?.trim()
    if (cityValue) criteria.city = cityValue
    if (stateValue) criteria.state = stateValue
  } else if (!criteria.city) {
    const looseDistrict = query.match(/([\u4e00-\u9fa5]{2,}(?:区|县|旗))/i)
    const stopwords = new Set(['附近', '以内', '以上', '以下', '左右', '价格', '租金', '预算', '公寓', '房源', '房子', '租房', '房屋'])
    if (looseDistrict && !stopwords.has(looseDistrict[1])) {
      criteria.state = looseDistrict[1]
    }
  }
  if (!criteria.city) {
    const cityCandidates = [
      '上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆', '天津',
      '武汉', '西安', '郑州', '长沙', '厦门', '青岛', '宁波', '福州', '合肥', '昆明',
      '沈阳', '大连', '哈尔滨'
    ]
    const hit = cityCandidates.find((name) => query.includes(name))
    if (hit) {
      criteria.city = hit
    }
  }

  // 房间数提取 - 支持英文和中文
  const bedroomMatch = query.match(/(\d+)\s*(?:室|房|居|房间|bedroom|bed|bedrooms|br|beds)/i) ||
    query.match(/(\d+)\s*bed/i)
  if (bedroomMatch) {
    const parsedValue = parseInt(bedroomMatch[1])
    criteria.minBedrooms = parsedValue
    const exactToken = query.match(/(\d+)\s*(?:室|卧|卧室|房|房间)/i)
    if (exactToken && parseInt(exactToken[1]) === parsedValue) {
      criteria.exactBedrooms = parsedValue
    }
  } else {
    const cnBedroomMatch = query.match(/([一二两三四五六七八九十]{1,3})\s*(?:室|房|居|房间|居室)/i)
    if (cnBedroomMatch) {
      const parsed = parseChineseNumber(cnBedroomMatch[1])
      if (parsed) {
        criteria.minBedrooms = parsed
        criteria.exactBedrooms = parsed
      }
    }
    const cnBedroomAlias = query.match(/([一二两三四五六七八九十]{1,3})\s*(?:卧|卧室)/i)
    if (cnBedroomAlias && !criteria.minBedrooms) {
      const parsed = parseChineseNumber(cnBedroomAlias[1])
      if (parsed) {
        criteria.minBedrooms = parsed
        criteria.exactBedrooms = parsed
      }
    }
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

  const propertyTypeMap: Record<string, string> = {
    studio: 'studio',
    'studio apartment': 'studio',
    工作室: 'studio',
    单间: 'studio',
    一居: 'apartment',
    两居: 'apartment',
    三居: 'apartment',
    公寓: 'apartment',
    apartment: 'apartment',
    condo: 'condo',
    复式: 'condo',
    house: 'house',
    别墅: 'villa',
    villa: 'villa',
    联排: 'townhouse',
    townhouse: 'townhouse'
  }
  const lowerQuery = query.toLowerCase()
  const propertyTypeEntry = Object.entries(propertyTypeMap).find(([key]) =>
    key.match(/^[a-z]/i) ? lowerQuery.includes(key.toLowerCase()) : query.includes(key)
  )
  if (propertyTypeEntry) {
    criteria.propertyType = propertyTypeEntry[1]
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
