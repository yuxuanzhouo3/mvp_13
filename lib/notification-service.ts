import { getDatabaseAdapter } from './db-adapter'

interface CreateNotificationParams {
  userId: string
  type: string
  title: string
  message: string
  link?: string
  metadata?: any
}

export async function createNotification(params: CreateNotificationParams) {
  const db = getDatabaseAdapter()
  const { userId, type, title, message, link, metadata } = params

  try {
    // 1. Fetch recent unread notifications for the user with the same type
    // We limit to 5 to avoid fetching too many
    const recentNotifications = await db.query('notifications', {
      userId,
      type,
      isRead: false
    })

    // 2. Check for duplicates within the last 60 seconds
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)

    const isDuplicate = recentNotifications.some((n: any) => {
      const createdAt = new Date(n.createdAt || n.created_at)
      
      // Check if created within last minute
      if (createdAt < oneMinuteAgo) return false

      // Check content similarity
      // Strict check: title and message must match
      if (n.title !== title) return false
      
      // For message, sometimes it might slightly differ if dynamic, but usually identical for system notifications
      // Let's check message equality
      if (n.message !== message) return false

      // Check metadata if provided in params
      if (metadata && typeof metadata === 'object') {
        const nMeta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : (n.metadata || {})
        // Check if all keys in params.metadata exist and match in nMeta
        for (const key in metadata) {
          if (metadata[key] !== nMeta[key]) return false
        }
      }

      return true
    })

    if (isDuplicate) {
      console.log(`[Notification] Skipped duplicate notification for user ${userId} type ${type}`)
      return null
    }

    // 3. Create the notification
    const notification = await db.create('notifications', {
      userId,
      type,
      title,
      message,
      link,
      metadata: typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
      isRead: false,
      createdAt: new Date() // Explicitly set creation time for consistency
    })

    return notification
  } catch (error) {
    console.error('[Notification] Failed to create notification:', error)
    // Don't throw, just log error so main flow isn't interrupted
    return null
  }
}
