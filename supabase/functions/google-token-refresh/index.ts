import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const body = await req.json().catch(() => ({}))
    const accountKey: string = body.account_key ?? 'default'

    const { data: tokenRow, error: fetchError } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('account_key', accountKey)
      .single()

    if (fetchError || !tokenRow) {
      return Response.json(
        { success: false, error: 'No hay token OAuth almacenado.' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    if (tokenRow.expires_at) {
      const expiresAt = new Date(tokenRow.expires_at).getTime()
      if (expiresAt > Date.now() + 5 * 60 * 1000) {
        return Response.json({ success: true, access_token: tokenRow.access_token }, { headers: CORS_HEADERS })
      }
    }

    const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokenRow.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshResp.ok) {
      console.error('[google-token-refresh] Refresh failed:', await refreshResp.text())
      return Response.json({ success: false, error: 'Error al refrescar token de Google' }, { status: 502, headers: CORS_HEADERS })
    }

    const tokens = await refreshResp.json()
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    await supabase
      .from('oauth_tokens')
      .update({ access_token: tokens.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('account_key', accountKey)

    return Response.json({ success: true, access_token: tokens.access_token }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[google-token-refresh]', err)
    return Response.json({ success: false, error: 'Error interno' }, { status: 500, headers: CORS_HEADERS })
  }
})
