import cloudbase from '@cloudbase/node-sdk'

const envId = process.env.CLOUDBASE_ENV_ID || process.env.NEXT_PUBLIC_CLOUDBASE_ENV_ID || ''
const secretId = process.env.CLOUDBASE_SECRET_ID || ''
const secretKey = process.env.CLOUDBASE_SECRET_KEY || ''

const app =
  envId && secretId && secretKey
    ? cloudbase.init({
        env: envId,
        secretId,
        secretKey,
      })
    : null

export const db: any = app
  ? app.database()
  : new Proxy(
      {},
      {
        get() {
          throw new Error('CloudBase is not configured')
        },
      }
    )
