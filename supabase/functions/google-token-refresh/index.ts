import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000 // 5 min before expiry

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface OAuthToken {
  id: string
  provider: string
  account_key: string
  access_token: string
  refresh_token: string
  expires_at: string
}

async function getValidAccessToken(accountKey = 'default'): Promise<string> {
  const { data: token, error } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('provider', 'google')
    .eq('account_key', accountKey)
    .single()

  if (error || !token) {
    throw new Error(`No Google token found for account_key="${accountKey}". Run OAuth setup first.`)
  }

  const expiresAt = new Date(token.expires_at).getTime()
  const needsRefresh = expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS

  if (!needsRefresh) {
    return token.access_token
  }

  // Refresh the token
  const refreshed = await refreshAccessToken(token.refresh_token)

  // Persist updated token
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const { error: updateError } = await supabase
    .from('oauth_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
    })
    .eq('id', token.id)

  if (updateError) {
    console.error('[token-refresh] Failed to persist refreshed token:', updateError)
  }

  return refreshed.access_token
}

async function refreshAccessToken(refreshToken: string) {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Google token refresh failed: ${resp.status} — ${body}`)
  }

  return resp.json() as Promise<{ access_token: string; expires_in: number }>
}

Deno.serve(async (req) => {
  // Internal endpoint — only callable by Edge Functions or service role
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const accountKey = body.account_key ?? 'default'
    const accessToken = await getValidAccessToken(accountKey)

    return Response.json({ access_token: accessToken })
  } catch (err) {
    console.error('[google-token-refresh]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Token refresh failed' },
      { status: 500 }
    )
  }
})

// Export for use by other Edge Functions in the same project
export { getValidAccessToken }
