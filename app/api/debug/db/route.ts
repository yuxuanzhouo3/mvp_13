import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Create a local instance to avoid global state issues for this test
const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
})

export async function GET() {
  const url = process.env.DATABASE_URL || ''
  const maskedUrl = url.replace(/:[^:]*@/, ':****@')
  
  console.log('[DebugDB] Testing connection to:', maskedUrl)
  
  const results = {
    env: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_DEFINED: !!process.env.DATABASE_URL,
      DATABASE_URL_MASKED: maskedUrl,
      NEXT_PUBLIC_APP_REGION: process.env.NEXT_PUBLIC_APP_REGION,
    },
    connection: 'pending',
    userCount: -1,
    error: null as any,
    duration: 0
  }
  
  const start = Date.now()
  
  try {
    await prisma.$connect()
    results.connection = 'connected'
    
    const count = await prisma.user.count()
    results.userCount = count
    
  } catch (e: any) {
    results.connection = 'failed'
    results.error = {
      name: e.name,
      message: e.message,
      code: e.code,
      meta: e.meta,
      stack: e.stack
    }
  } finally {
    results.duration = Date.now() - start
    await prisma.$disconnect()
  }
  
  return NextResponse.json(results)
}
