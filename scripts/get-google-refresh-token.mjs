/**
 * Script para obtener el refresh token de Google Calendar
 * Ejecutar: node scripts/get-google-refresh-token.mjs
 *
 * Pre-requisito: agregar http://localhost en Google Cloud Console
 * APIs & Services → Credentials → tu OAuth Client → Authorized redirect URIs
 */

import { createServer } from 'http'
import { createInterface } from 'readline'

const CLIENT_ID = '358511777295-vjf5glkltbfc27hl4a7jvbdu01hblska.apps.googleusercontent.com'
const CLIENT_SECRET = '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'
const REDIRECT_URI = 'http://localhost'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ')

// Paso 1: Generar URL de autorización
const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`  // fuerza que Google devuelva refresh_token siempre

console.log('\n==========================================')
console.log(' PASO 1: Abre esta URL en tu navegador')
console.log('==========================================')
console.log('\n' + authUrl + '\n')
console.log('Autoriza con la cuenta que tiene acceso a los calendarios.')
console.log('El navegador intentará abrir http://localhost (fallará — eso es normal).')
console.log('Copia el parámetro "code=..." de la URL del navegador.\n')

// Paso 2: Pedir el code al usuario
const rl = createInterface({ input: process.stdin, output: process.stdout })

rl.question('Pega el código aquí (el valor después de "code="): ', async (code) => {
  rl.close()

  // Limpiar el code por si el usuario pegó la URL completa
  let cleanCode = code.trim()
  if (cleanCode.includes('code=')) {
    const match = cleanCode.match(/code=([^&]+)/)
    if (match) cleanCode = decodeURIComponent(match[1])
  }

  console.log('\nIntercambiando código por tokens...')

  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: cleanCode,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    const data = await resp.json()

    if (!resp.ok) {
      console.error('\n❌ Error:', JSON.stringify(data, null, 2))
      console.log('\nSi el error es "redirect_uri_mismatch", agrega http://localhost')
      console.log('en los Authorized Redirect URIs de Google Cloud Console y vuelve a intentar.')
      process.exit(1)
    }

    console.log('\n==========================================')
    console.log(' ✅ TOKENS OBTENIDOS')
    console.log('==========================================')
    console.log(`\nAccess Token : ${data.access_token?.substring(0, 30)}...`)
    console.log(`Refresh Token: ${data.refresh_token}`)
    console.log(`Expira en    : ${data.expires_in} segundos`)
    console.log(`Scope        : ${data.scope}`)

    console.log('\n==========================================')
    console.log(' PASO 2: Inserta esto en Supabase SQL Editor')
    console.log('==========================================')
    console.log(`
INSERT INTO public.oauth_tokens (
  provider,
  account_key,
  access_token,
  refresh_token,
  expires_at,
  scope
) VALUES (
  'google',
  'default',
  '${data.access_token}',
  '${data.refresh_token}',
  now() - interval '1 second',
  '${data.scope}'
)
ON CONFLICT (provider, account_key) DO UPDATE SET
  access_token  = EXCLUDED.access_token,
  refresh_token = EXCLUDED.refresh_token,
  expires_at    = EXCLUDED.expires_at,
  scope         = EXCLUDED.scope,
  updated_at    = now();
`)

    console.log('==========================================')
    console.log(' TAMBIÉN necesitas estos Secrets en Supabase Edge Functions:')
    console.log('==========================================')
    console.log(`GOOGLE_CLIENT_ID     = ${CLIENT_ID}`)
    console.log(`GOOGLE_CLIENT_SECRET = ${CLIENT_SECRET}`)
    console.log('')

  } catch (err) {
    console.error('Error de red:', err.message)
    process.exit(1)
  }
})
