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

async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const { data: tokenRow, error } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('account_key', 'default')
      .single()

    if (error || !tokenRow) return null

    if (tokenRow.expires_at) {
      const expiresAt = new Date(tokenRow.expires_at).getTime()
      if (expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokenRow.access_token
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

    if (!refreshResp.ok) return null

    const tokens = await refreshResp.json()
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    await supabase
      .from('oauth_tokens')
      .update({ access_token: tokens.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('account_key', 'default')

    return tokens.access_token
  } catch {
    return null
  }
}

async function createGoogleCalendarEvent(params: {
  accessToken: string
  calendarId: string
  title: string
  fecha: string
  startTime: string
  endTime: string
  timezone: string
  leadEmail: string
  leadName: string
  commercialEmail?: string
  commercialName?: string
}): Promise<{ id: string; htmlLink: string }> {
  // Asegurar formato HH:MM:SS
  const pad = (t: string) => t.length === 5 ? `${t}:00` : t
  const startDatetime = `${params.fecha}T${pad(params.startTime)}`
  const endDatetime = `${params.fecha}T${pad(params.endTime)}`

  // Construir lista de asistentes
  const attendees: { email: string; displayName?: string }[] = []
  if (params.commercialEmail) {
    attendees.push({ email: params.commercialEmail, displayName: params.commercialName })
  }
  if (params.leadEmail && params.leadEmail !== 'sin-email@manual.com') {
    attendees.push({ email: params.leadEmail, displayName: params.leadName })
  }

  const event = {
    summary: params.title,
    start: { dateTime: startDatetime, timeZone: params.timezone },
    end: { dateTime: endDatetime, timeZone: params.timezone },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events?sendUpdates=all`
  console.log('[create-gcal] POST', url, 'attendees:', attendees.map(a => a.email))

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!resp.ok) {
    const errBody = await resp.text()
    throw new Error(`GCal ${resp.status}: ${errBody}`)
  }
  return resp.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400, headers: CORS_HEADERS })
  }

  const appointment_id = body.appointment_id
  if (typeof appointment_id !== 'string' || appointment_id.trim() === '') {
    return Response.json({ ok: false, error: 'appointment_id es requerido' }, { status: 400, headers: CORS_HEADERS })
  }

  try {
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointment_id)
      .single()

    if (apptError || !appointment) {
      return Response.json({ ok: false, error: 'Appointment no encontrado' }, { status: 404, headers: CORS_HEADERS })
    }

    const { data: config, error: configError } = await supabase
      .from('booking_configs')
      .select('name, gcal_calendar_id')
      .eq('booking_id', appointment.booking_id)
      .single()

    if (configError || !config) {
      return Response.json({ ok: false, error: 'booking_config no encontrado' }, { status: 404, headers: CORS_HEADERS })
    }

    const serviceName: string = (config.name as string) ?? 'Servicio'

    const accessToken = await getGoogleAccessToken()
    if (!accessToken) {
      return Response.json({ ok: false, error: 'No hay token de Google configurado. Conecta la cuenta en el panel de administración.' }, { status: 502, headers: CORS_HEADERS })
    }

    // Calendario destino: primero intentar el calendario del comercial asignado
    let calendarId: string = (config.gcal_calendar_id as string) ?? 'primary'
    let commercialEmail: string | undefined
    let commercialName: string | undefined

    if (appointment.assigned_commercial_id) {
      const { data: commercial, error: commercialError } = await supabase
        .from('commercial_calendars')
        .select('calendar_id, email, name')
        .eq('id', appointment.assigned_commercial_id)
        .single()

      if (!commercialError && commercial) {
        calendarId = (commercial.calendar_id as string) || calendarId
        commercialEmail = commercial.email as string
        commercialName = commercial.name as string
      }
    } else if (appointment.assigned_commercial_name) {
      // Si hay nombre pero no ID (legado), buscar por nombre en commercial_calendars
      const { data: commercial } = await supabase
        .from('commercial_calendars')
        .select('calendar_id, email, name')
        .eq('name', appointment.assigned_commercial_name)
        .eq('status', 'active')
        .maybeSingle()

      if (commercial) {
        calendarId = (commercial.calendar_id as string) || calendarId
        commercialEmail = commercial.email as string
        commercialName = commercial.name as string
      }
    }

    console.log('[create-gcal] calendarId:', calendarId, 'commercial:', commercialEmail)

    const gcalEvent = await createGoogleCalendarEvent({
      accessToken,
      calendarId,
      title: `${appointment.lead_name} – ${serviceName}`,
      fecha: appointment.appointment_date,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      timezone: appointment.timezone ?? 'America/Bogota',
      leadEmail: appointment.lead_email ?? '',
      leadName: appointment.lead_name,
      commercialEmail,
      commercialName,
    })

    await supabase
      .from('appointments')
      .update({
        gcal_event_id: gcalEvent.id,
        gcal_html_link: gcalEvent.htmlLink,
        gcal_sync_status: 'synced',
        gcal_synced_at: new Date().toISOString(),
      })
      .eq('id', appointment_id)

    return Response.json(
      { ok: true, gcal_event_id: gcalEvent.id, gcal_html_link: gcalEvent.htmlLink },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[create-gcal-for-appointment]', errMsg)

    await supabase
      .from('appointments')
      .update({ gcal_sync_status: 'failed', gcal_last_error: errMsg })
      .eq('id', appointment_id)

    return Response.json({ ok: false, error: errMsg }, { status: 500, headers: CORS_HEADERS })
  }
})
