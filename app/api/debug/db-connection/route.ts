import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * 调试端点：测试数据库连接
 */
export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL
    
    const result: any = {
      timestamp: new Date().toISOString(),
      hasDatabaseUrl: !!databaseUrl,
      connectionTest: null,
      error: null,
    }
    
    if (!databaseUrl) {
      return NextResponse.json({
        ...result,
        error: 'DATABASE_URL 环境变量未配置',
        suggestion: '请在 .env 或 .env.local 文件中配置 DATABASE_URL'
      }, { status: 500 })
    }
    
    // 解析连接字符串（隐藏密码）
    try {
      const url = new URL(databaseUrl)
      result.connectionInfo = {
        host: url.hostname,
        port: url.port || '默认',
        database: url.pathname,
        isSupabase: databaseUrl.includes('supabase.co'),
        isPooler: databaseUrl.includes(':6543'),
        hasPassword: !!url.password,
      }
    } catch (e) {
      result.connectionInfo = {
        error: '无法解析 DATABASE_URL',
        raw: databaseUrl.substring(0, 50) + '...'
      }
    }
    
    // 测试连接
    try {
      console.log('[DB Test] 开始测试数据库连接...')
      
      // 测试连接
      await prisma.$connect()
      result.connectionTest = {
        status: 'success',
        message: '数据库连接成功'
      }
      
      // 测试简单查询
      try {
        const userCount = await prisma.user.count()
        result.queryTest = {
          status: 'success',
          message: '查询成功',
          userCount
        }
      } catch (queryError: any) {
        result.queryTest = {
          status: 'error',
          message: queryError.message,
          error: queryError.code
        }
      }
      
      await prisma.$disconnect()
      
    } catch (error: any) {
      const errorMsg = String(error?.message || '')
      const lower = errorMsg.toLowerCase()
      
      result.connectionTest = {
        status: 'error',
        message: errorMsg,
        code: error?.code,
      }
      
      // 诊断问题
      result.diagnosis = []
      
      if (lower.includes("can't reach") || lower.includes('connection') || lower.includes('timeout')) {
        result.diagnosis.push({
          type: 'network',
          issue: '网络连接问题',
          suggestions: [
            '检查 DATABASE_URL 中的主机地址是否正确',
            '检查网络连接',
            '如果使用 Supabase，检查项目状态',
            '检查防火墙设置'
          ]
        })
      }
      
      if (lower.includes('authentication') || lower.includes('password')) {
        result.diagnosis.push({
          type: 'authentication',
          issue: '认证失败',
          suggestions: [
            '检查 DATABASE_URL 中的用户名和密码',
            '如果密码包含特殊字符，需要进行 URL 编码',
            '在 Supabase Dashboard 中重置数据库密码'
          ]
        })
      }
      
      if (lower.includes('maxclients') || lower.includes('too many')) {
        result.diagnosis.push({
          type: 'pool',
          issue: '连接池已满',
          suggestions: [
            '使用连接池 URL (端口 6543)',
            '等待一段时间后重试',
            '检查是否有其他应用在使用连接'
          ]
        })
      }
      
      if (lower.includes('database') && lower.includes('not exist')) {
        result.diagnosis.push({
          type: 'database',
          issue: '数据库不存在',
          suggestions: [
            '检查 DATABASE_URL 中的数据库名称',
            'Supabase 默认数据库名是 "postgres"'
          ]
        })
      }
      
      result.error = errorMsg
    }
    
    return NextResponse.json(result, { status: 200 })
    
  } catch (error: any) {
    return NextResponse.json({
      error: '测试失败',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
