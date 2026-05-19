import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://effidiagnosticos.com'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface BusyPeriod {
  start: string
  end: string
}

interface CommercialMember {
  id: string           // UUID en commercial_calendars
  calendar_id: string  // ID del calendario de Google (email generalmente)
  name: string
  email: string
  meeting_link: string | null
}

interface GCalEvent {
  id: string
  htmlLink: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Google OAuth token — lee y refresca directamente desde oauth_tokens
// ---------------------------------------------------------------------------

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!

async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const { data: tokenRow, error } = await supabase
      .from('oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('account_key', 'default')
      .single()

    if (error || !tokenRow) return null

    // Token aún válido (margen 5 min)
    if (tokenRow.expires_at) {
      const expiresAt = new Date(tokenRow.expires_at).getTime()
      if (expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokenRow.access_token
      }
    }

    // Refrescar token
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
      console.error('[create-booking] Token refresh failed:', await refreshResp.text())
      return null
    }

    const tokens = await refreshResp.json()
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

    await supabase
      .from('oauth_tokens')
      .update({ access_token: tokens.access_token, expires_at: newExpiresAt, updated_at: new Date().toISOString() })
      .eq('account_key', 'default')

    return tokens.access_token
  } catch (err) {
    console.error('[create-booking] getGoogleAccessToken error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Google Calendar freeBusy — verificar si UN slot exacto está libre para un comercial
// ---------------------------------------------------------------------------

async function isCalendarFree(
  accessToken: string,
  calendarId: string,
  fecha: string,
  hora: string,
  endTime: string
): Promise<boolean> {
  const timeMin = `${fecha}T${hora}:00-05:00`
  const timeMax = `${fecha}T${endTime}:00-05:00`

  try {
    const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: 'America/Bogota',
        items: [{ id: calendarId }],
      }),
    })

    if (!resp.ok) {
      console.error('[create-booking] freeBusy check failed:', resp.status)
      return true // Asumir libre ante error (no bloquear)
    }

    const data = await resp.json()
    const busy: BusyPeriod[] = data.calendars?.[calendarId]?.busy ?? []
    return busy.length === 0
  } catch (err) {
    console.error('[create-booking] freeBusy check error:', err)
    return true // Degradación graceful
  }
}

// ---------------------------------------------------------------------------
// Google Calendar freeBusy — múltiples calendarios para el slot exacto
// Retorna Map<calendarId, isFree>
// ---------------------------------------------------------------------------

async function checkMultipleCalendarsFree(
  accessToken: string,
  members: CommercialMember[],
  fecha: string,
  hora: string,
  endTime: string
): Promise<Map<string, boolean>> {
  const timeMin = `${fecha}T${hora}:00-05:00`
  const timeMax = `${fecha}T${endTime}:00-05:00`
  const result = new Map<string, boolean>()

  if (members.length === 0) return result

  try {
    const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        timeZone: 'America/Bogota',
        items: members.map((m) => ({ id: m.calendar_id })),
      }),
    })

    if (!resp.ok) {
      console.error('[create-booking] freeBusy multiple failed:', resp.status)
      // Asumir todos libres ante error
      members.forEach((m) => result.set(m.calendar_id, true))
      return result
    }

    const data = await resp.json()
    members.forEach((m) => {
      const busy: BusyPeriod[] = data.calendars?.[m.calendar_id]?.busy ?? []
      result.set(m.calendar_id, busy.length === 0)
    })
    return result
  } catch (err) {
    console.error('[create-booking] freeBusy multiple error:', err)
    members.forEach((m) => result.set(m.calendar_id, true))
    return result
  }
}

// ---------------------------------------------------------------------------
// Contar appointments de HOY en DB para un comercial dado (round-robin)
// ---------------------------------------------------------------------------

async function countAppointmentsToday(commercialId: string, fecha: string): Promise<number> {
  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_commercial_id', commercialId)
    .eq('appointment_date', fecha)
    .in('status', ['pending', 'confirmed'])

  if (error) {
    console.error('[create-booking] countAppointmentsToday error:', error)
    return 0
  }
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Seleccionar comercial para grupo (round-robin por menor carga del día)
// ---------------------------------------------------------------------------

async function selectCommercialFromGroup(
  members: CommercialMember[],
  accessToken: string | null,
  fecha: string,
  hora: string,
  endTime: string
): Promise<CommercialMember> {
  // Paso 1: Si hay token, verificar cuáles están libres en Google Calendar
  let freeMembers: CommercialMember[] = []

  if (accessToken && members.length > 0) {
    const freedomMap = await checkMultipleCalendarsFree(accessToken, members, fecha, hora, endTime)
    freeMembers = members.filter((m) => freedomMap.get(m.calendar_id) !== false)
  }

  // Si ninguno está libre en Google (o no hay token), usar todos para round-robin
  const candidatePool = freeMembers.length > 0 ? freeMembers : members

  // Paso 2: Round-robin — elegir el de MENOS appointments hoy en DB
  const counts = await Promise.all(
    candidatePool.map(async (m) => ({
      member: m,
      count: await countAppointmentsToday(m.id, fecha),
    }))
  )

  // Ordenar por menor cantidad de appointments
  counts.sort((a, b) => a.count - b.count)

  return counts[0].member
}

// ---------------------------------------------------------------------------
// Crear evento en Google Calendar del comercial
// ---------------------------------------------------------------------------

async function createGoogleCalendarEvent(params: {
  accessToken: string
  calendarId: string
  title: string
  description: string
  location?: string
  fecha: string
  hora: string
  endTime: string
  attendeeEmail: string
  attendeeName: string
}): Promise<GCalEvent> {
  const startDatetime = `${params.fecha}T${params.hora}:00-05:00`
  const endDatetime = `${params.fecha}T${params.endTime}:00-05:00`

  const event: Record<string, unknown> = {
    summary: params.title,
    description: params.description,
    ...(params.location ? { location: params.location } : {}),
    start: { dateTime: startDatetime, timeZone: 'America/Bogota' },
    end: { dateTime: endDatetime, timeZone: 'America/Bogota' },
    attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
  }

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events?sendUpdates=all`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  )

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Google Calendar event creation failed: ${resp.status} — ${body}`)
  }

  return resp.json() as Promise<GCalEvent>
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  const requestId = crypto.randomUUID()
  const rawIp = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null
  const ip = rawIp ? rawIp.split(',')[0].trim() : null
  const userAgent = req.headers.get('user-agent') ?? null

  try {
    // -----------------------------------------------------------------------
    // 1. Parsear y validar input (sin zod)
    // -----------------------------------------------------------------------
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return Response.json(
        { success: false, error: 'JSON inválido' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const booking_id = body.booking_id
    const fecha = body.fecha
    const hora = body.hora
    const form_data = (body.form_data ?? {}) as Record<string, unknown>

    if (typeof booking_id !== 'string' || booking_id.trim() === '') {
      return Response.json(
        { success: false, error: 'booking_id es requerido' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return Response.json(
        { success: false, error: 'fecha debe tener formato YYYY-MM-DD' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (typeof hora !== 'string' || !/^\d{2}:\d{2}$/.test(hora)) {
      return Response.json(
        { success: false, error: 'hora debe tener formato HH:MM' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Extraer nombre/email desde top-level o form_data
    const leadName: string = String(body.name ?? form_data.name ?? '').trim()
    const leadEmail: string = String(body.email ?? form_data.email ?? '').trim()
    const leadCompany: string = String(body.company ?? form_data.company ?? '').trim()
    const leadNotes: string = String(body.notes ?? form_data.notes ?? '').trim()

    if (!leadName) {
      return Response.json(
        { success: false, error: 'El nombre es requerido' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    if (!leadEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)) {
      return Response.json(
        { success: false, error: 'Email inválido o requerido' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // -----------------------------------------------------------------------
    // 2. Obtener configuración del booking
    // -----------------------------------------------------------------------
    const { data: config, error: configError } = await supabase
      .from('booking_configs')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('active', true)
      .single()

    if (configError || !config) {
      return Response.json(
        { success: false, error: 'Booking no encontrado o inactivo' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    const endTime = addMinutes(hora, config.duration)
    const assignmentType: string = config.assignment_type ?? 'individual'

    // -----------------------------------------------------------------------
    // 3. Determinar qué comercial se asigna
    // -----------------------------------------------------------------------
    let assignedCommercial: CommercialMember | null = null
    const accessToken = await getGoogleAccessToken()

    if (assignmentType === 'group' && config.commercial_group_id) {
      // Obtener miembros activos del grupo
      const { data: members, error: membersError } = await supabase
        .from('commercial_group_members')
        .select(`
          commercial_id,
          commercial_calendars!inner(
            id,
            calendar_id,
            name,
            email,
            status,
            meeting_link
          )
        `)
        .eq('group_id', config.commercial_group_id)
        .eq('commercial_calendars.status', 'active')

      if (membersError || !members || members.length === 0) {
        return Response.json(
          { success: false, error: 'No hay comerciales disponibles en el grupo' },
          { status: 503, headers: CORS_HEADERS }
        )
      }

      const groupMembers: CommercialMember[] = members.map((m: Record<string, unknown>) => {
        const cal = m.commercial_calendars as Record<string, unknown>
        return {
          id: cal.id as string,
          calendar_id: cal.calendar_id as string,
          name: cal.name as string,
          email: cal.email as string,
          meeting_link: (cal.meeting_link as string | null) ?? null,
        }
      })

      assignedCommercial = await selectCommercialFromGroup(
        groupMembers,
        accessToken,
        fecha,
        hora,
        endTime
      )
    } else {
      // Individual: buscar el comercial por gcal_calendar_id en commercial_calendars
      const gcalCalendarId: string = config.gcal_calendar_id ?? 'primary'

      const { data: commercial, error: commercialError } = await supabase
        .from('commercial_calendars')
        .select('id, calendar_id, name, email, meeting_link')
        .eq('calendar_id', gcalCalendarId)
        .eq('status', 'active')
        .single()

      if (!commercialError && commercial) {
        assignedCommercial = {
          id: commercial.id,
          calendar_id: commercial.calendar_id,
          name: commercial.name,
          email: commercial.email,
          meeting_link: commercial.meeting_link ?? null,
        }
      }
      // Si no se encuentra comercial en commercial_calendars, se continúa sin assigned_commercial_id
      // pero sí con el gcal_calendar_id para el sync de Google Calendar
    }

    // -----------------------------------------------------------------------
    // 4. Adquirir lock para prevenir double-booking
    // -----------------------------------------------------------------------
    const lockId = crypto.randomUUID()
    const { error: lockError } = await supabase.from('availability_locks').insert({
      booking_id,
      slot_date: fecha,
      slot_time: hora,
      locked_by: lockId,
    })

    if (lockError) {
      // Violación de UNIQUE constraint = slot ya bloqueado
      return Response.json(
        { success: false, error: 'Este horario ya fue reservado. Por favor elige otro.' },
        { status: 409, headers: CORS_HEADERS }
      )
    }

    try {
      // -----------------------------------------------------------------------
      // 5. Verificar disponibilidad en DB con función is_slot_available
      // -----------------------------------------------------------------------
      const { data: isAvailable, error: availError } = await supabase.rpc('is_slot_available', {
        p_booking_id: booking_id,
        p_date: fecha,
        p_start_time: hora,
        p_end_time: endTime,
      })

      if (availError) {
        console.error('[create-booking] is_slot_available error:', availError)
      }

      if (isAvailable === false) {
        return Response.json(
          { success: false, error: 'Este horario ya no está disponible.' },
          { status: 409, headers: CORS_HEADERS }
        )
      }

      // -----------------------------------------------------------------------
      // 6. Insertar appointment en Supabase (fuente de verdad)
      // -----------------------------------------------------------------------
      const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .insert({
          booking_id,
          crm_pipeline_id: (config.crm_pipeline_id as string | null) ?? null,
          lead_name: leadName,
          lead_email: leadEmail,
          lead_company: leadCompany || null,
          lead_notes: leadNotes || null,
          form_data,
          appointment_date: fecha,
          start_time: hora,
          end_time: endTime,
          duration_minutes: config.duration,
          timezone: 'America/Bogota',
          status: 'confirmed',
          gcal_sync_status: 'pending',
          source: 'web',
          ip_address: ip,
          user_agent: userAgent,
          assigned_commercial_id: assignedCommercial?.id ?? null,
        })
        .select()
        .single()

      if (apptError || !appointment) {
        throw new Error(`Failed to create appointment: ${apptError?.message}`)
      }

      // Log de creación
      await supabase.from('audit_log').insert({
        request_id: requestId,
        entity_type: 'appointment',
        entity_id: appointment.id,
        action: 'created',
        actor: 'edge_function:create-booking',
        metadata: {
          booking_id,
          fecha,
          hora,
          lead_email: leadEmail,
          assignment_type: assignmentType,
          assigned_commercial_id: assignedCommercial?.id ?? null,
          assigned_commercial_name: assignedCommercial?.name ?? null,
        },
      })

      // -----------------------------------------------------------------------
      // 7. Sincronizar con Google Calendar del comercial asignado
      // El evento se crea en el calendario del comercial (tienen permisos compartidos
      // con estrategaeffi@gmail.com). El lead queda como invitado.
      // -----------------------------------------------------------------------
      const gcalCalendarId = assignedCommercial?.calendar_id ?? (config.gcal_calendar_id as string) ?? 'primary'

      // Booking-level link takes priority over commercial-level link
      const meetingLink = (config.meeting_link as string | null) ?? assignedCommercial?.meeting_link ?? null

      const gcalResult = await syncToGoogleCalendar({
        appointmentId: appointment.id,
        config,
        calendarId: gcalCalendarId,
        leadName,
        leadEmail,
        formData: form_data,
        meetingLink,
        fecha,
        hora,
        endTime,
        requestId,
        accessToken,
      })

      // -----------------------------------------------------------------------
      // 8. Respuesta exitosa
      // -----------------------------------------------------------------------
      return Response.json(
        {
          success: true,
          data: {
            appointment_id: appointment.id,
            booking_id,
            fecha,
            hora,
            end_time: endTime,
            lead_name: leadName,
            lead_email: leadEmail,
            assigned_commercial: assignedCommercial
              ? {
                  id: assignedCommercial.id,
                  name: assignedCommercial.name,
                  email: assignedCommercial.email,
                  meeting_link: meetingLink,
                }
              : null,
            gcal_link: gcalResult?.htmlLink ?? null,
            gcal_synced: !!gcalResult,
          },
        },
        { headers: CORS_HEADERS }
      )
    } finally {
      // Siempre liberar el lock
      await supabase.from('availability_locks').delete().eq('locked_by', lockId)
    }
  } catch (err) {
    console.error(`[create-booking][${requestId}]`, err)

    // Intentar registrar el error en audit_log (best-effort)
    try {
      await supabase.from('audit_log').insert({
        request_id: requestId,
        entity_type: 'appointment',
        action: 'error',
        actor: 'edge_function:create-booking',
        metadata: { error: err instanceof Error ? err.message : String(err) },
      })
    } catch {
      // Ignorar errores del audit_log en el handler de errores
    }

    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        request_id: requestId,
      },
      { status: 500, headers: CORS_HEADERS }
    )
  }
})

// ---------------------------------------------------------------------------
// Sincronización con Google Calendar
// ---------------------------------------------------------------------------

async function syncToGoogleCalendar(params: {
  appointmentId: string
  config: Record<string, unknown>
  calendarId: string
  leadName: string
  leadEmail: string
  formData: Record<string, unknown>
  meetingLink: string | null
  fecha: string
  hora: string
  endTime: string
  requestId: string
  accessToken: string | null
}): Promise<{ htmlLink: string } | null> {
  if (!params.accessToken) {
    await supabase
      .from('appointments')
      .update({ gcal_sync_status: 'skipped', gcal_last_error: 'No token available' })
      .eq('id', params.appointmentId)
    return null
  }

  try {
    // Descripción formateada con los campos del formulario
    const descLines: string[] = []
    Object.entries(params.formData).forEach(([label, value]) => {
      if (value !== undefined && String(value).trim()) {
        descLines.push(`${label}: ${String(value)}`)
      }
    })
    descLines.push('')
    descLines.push(`Duración: ${params.config.duration ?? 30} minutos`)
    descLines.push('Zona horaria: Colombia (UTC-5)')
    if (params.meetingLink) {
      descLines.push(`Link de reunión: ${params.meetingLink}`)
    }
    const description = descLines.join('\n')

    const gcalEvent = await createGoogleCalendarEvent({
      accessToken: params.accessToken,
      calendarId: params.calendarId,
      title: `${params.config.name ?? params.config.title} — ${params.leadName}`,
      description,
      location: params.meetingLink ?? undefined,
      fecha: params.fecha,
      hora: params.hora,
      endTime: params.endTime,
      attendeeEmail: params.leadEmail,
      attendeeName: params.leadName,
    })

    await supabase
      .from('appointments')
      .update({
        gcal_event_id: gcalEvent.id,
        gcal_html_link: gcalEvent.htmlLink,
        gcal_sync_status: 'synced',
        gcal_synced_at: new Date().toISOString(),
      })
      .eq('id', params.appointmentId)

    await supabase.from('audit_log').insert({
      request_id: params.requestId,
      entity_type: 'appointment',
      entity_id: params.appointmentId,
      action: 'gcal_synced',
      actor: 'edge_function:create-booking',
      metadata: { gcal_event_id: gcalEvent.id, calendar_id: params.calendarId },
    })

    return { htmlLink: gcalEvent.htmlLink }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[create-booking] Google Calendar sync failed:', errMsg)

    await supabase
      .from('appointments')
      .update({
        gcal_sync_status: 'failed',
        gcal_last_error: errMsg,
        gcal_sync_attempts: 1,
      })
      .eq('id', params.appointmentId)

    return null
  }
}
