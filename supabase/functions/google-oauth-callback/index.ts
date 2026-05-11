import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://effidiagnosticos.vercel.app'

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return new Response(`<h1>Error de autorización</h1><p>${error}</p>`, {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (!code) {
    return new Response('<h1>Código de autorización no recibido</h1>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  try {
    // Intercambiar código por tokens
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResp.ok) {
      const errBody = await tokenResp.text()
      console.error('[google-oauth-callback] Token exchange failed:', errBody)
      return new Response(`<h1>Error al obtener tokens</h1><pre>${errBody}</pre>`, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const tokens = await tokenResp.json()

    if (!tokens.refresh_token) {
      return new Response(
        `<h1>Error: no se recibió refresh_token</h1>
         <p>Asegúrate de revocar el acceso previo en <a href="https://myaccount.google.com/permissions">Google Account Permissions</a> y vuelve a autorizar.</p>`,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    // Guardar/actualizar en oauth_tokens (insert o update según exista)
    const { data: existing } = await supabase
      .from('oauth_tokens')
      .select('id')
      .eq('account_key', 'default')
      .maybeSingle()

    const tokenPayload = {
      account_key: 'default',
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type ?? 'Bearer',
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = existing
      ? await supabase.from('oauth_tokens').update(tokenPayload).eq('account_key', 'default')
      : await supabase.from('oauth_tokens').insert(tokenPayload)

    if (saveError) {
      console.error('[google-oauth-callback] Save error:', saveError)
      return new Response(`<h1>Error al guardar token</h1><pre>${saveError.message}</pre>`, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Google Calendar conectado</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px">
          <h1>✅ Google Calendar conectado correctamente</h1>
          <p>La cuenta <strong>estrategaeffi@gmail.com</strong> está lista para sincronizar citas.</p>
          <p><a href="${APP_URL}/admin">Volver al admin</a></p>
        </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (err) {
    console.error('[google-oauth-callback]', err)
    return new Response(`<h1>Error interno</h1><pre>${err}</pre>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
})
