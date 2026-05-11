import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://effidiagnosticos.com'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const BookingRequestSchema = z.object({
  booking_id: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  form_data: z.record(z.unknown()).default({}),
  // Extracted from form_data for convenience
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
})

async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-token-refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ account_key: 'default' }),
    })
    if (!resp.ok) return null
    const { access_token } = await resp.json()
    return access_token
  } catch {
    return null
  }
}

async function createGoogleCalendarEvent(params: {
  accessToken: string
  calendarId: string   // calendario del comercial (ej: juan@effi.com)
  title: string
  description: string
  date: string
  startTime: string
  endTime: string
  attendeeEmail: string
  attendeeName: string
  timezone: string
}) {
  const startDatetime = `${params.date}T${params.startTime}:00`
  const endDatetime = `${params.date}T${params.endTime}:00`

  const event = {
    summary: params.title,
    description: params.description,
    start: { dateTime: startDatetime, timeZone: params.timezone },
    end: { dateTime: endDatetime, timeZone: params.timezone },
    attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 30 },
      ],
    },
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  }

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
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

  return resp.json() as Promise<{ id: string; htmlLink: string }>
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const requestId = crypto.randomUUID()
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
  const userAgent = req.headers.get('user-agent')

  try {
    const body = await req.json()
    const parsed = BookingRequestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const { booking_id, fecha, hora, form_data } = parsed.data

    // Extract name/email from form_data if not at top level
    const leadName: string = (parsed.data.name ?? form_data.name ?? '') as string
    const leadEmail: string = (parsed.data.email ?? form_data.email ?? '') as string
    const leadCompany: string = (parsed.data.company ?? form_data.company ?? '') as string
    const leadNotes: string = (parsed.data.notes ?? form_data.notes ?? '') as string

    if (!leadName || !leadEmail) {
      return Response.json(
        { success: false, error: 'Nombre y email son requeridos' },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    // Get booking config
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

    // Acquire slot lock (prevents double-booking)
    const lockId = crypto.randomUUID()
    const { error: lockError } = await supabase.from('availability_locks').insert({
      booking_id,
      slot_date: fecha,
      slot_time: hora,
      locked_by: lockId,
    })

    if (lockError) {
      // UNIQUE constraint violation = slot already locked
      return Response.json(
        { success: false, error: 'Este horario ya fue reservado. Por favor elige otro.' },
        { status: 409, headers: CORS_HEADERS }
      )
    }

    try {
      // Double-check: no confirmed appointment for this slot
      const available = await supabase.rpc('is_slot_available', {
        p_booking_id: booking_id,
        p_date: fecha,
        p_start_time: hora,
        p_end_time: endTime,
      })

      if (!available.data) {
        return Response.json(
          { success: false, error: 'Este horario ya no está disponible.' },
          { status: 409, headers: CORS_HEADERS }
        )
      }

      // Create appointment in Supabase (source of truth)
      const { data: appointment, error: apptError } = await supabase
        .from('appointments')
        .insert({
          booking_id,
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
        })
        .select()
        .single()

      if (apptError || !appointment) {
        throw new Error(`Failed to create appointment: ${apptError?.message}`)
      }

      // Log creation
      await supabase.from('audit_log').insert({
        request_id: requestId,
        entity_type: 'appointment',
        entity_id: appointment.id,
        action: 'created',
        actor: 'edge_function:create-booking',
        metadata: { booking_id, fecha, hora, lead_email: leadEmail },
      })

      // Try Google Calendar sync (async, non-blocking)
      const gcalResult = await syncToGoogleCalendar({
        appointmentId: appointment.id,
        config,
        leadName,
        leadEmail,
        fecha,
        hora,
        endTime,
        requestId,
      })

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
            gcal_link: gcalResult?.htmlLink ?? null,
            gcal_synced: !!gcalResult,
          },
        },
        { headers: CORS_HEADERS }
      )
    } finally {
      // Always release the lock
      await supabase.from('availability_locks').delete().eq('locked_by', lockId)
    }
  } catch (err) {
    console.error(`[create-booking][${requestId}]`, err)

    await supabase.from('audit_log').insert({
      request_id: requestId,
      entity_type: 'appointment',
      action: 'error',
      actor: 'edge_function:create-booking',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    })

    return Response.json(
      { success: false, error: 'Error al crear la cita. Intenta de nuevo.', request_id: requestId },
      { status: 500, headers: CORS_HEADERS }
    )
  }
})

async function syncToGoogleCalendar(params: {
  appointmentId: string
  config: Record<string, unknown>
  leadName: string
  leadEmail: string
  fecha: string
  hora: string
  endTime: string
  requestId: string
}): Promise<{ htmlLink: string } | null> {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) {
    await supabase
      .from('appointments')
      .update({ gcal_sync_status: 'skipped', gcal_last_error: 'No token available' })
      .eq('id', params.appointmentId)
    return null
  }

  try {
    const description = [
      `Reunión agendada desde ${APP_URL}`,
      params.config.subtitle ? `\n${params.config.subtitle}` : '',
      `\nContacto: ${params.leadName} <${params.leadEmail}>`,
      params.config.duration ? `\nDuración: ${params.config.duration} minutos` : '',
    ]
      .filter(Boolean)
      .join('')

    // Usa el calendario del comercial específico (accedido con tu cuenta principal)
    const calendarId = (params.config.gcal_calendar_id as string) || 'primary'

    const gcalEvent = await createGoogleCalendarEvent({
      accessToken,
      calendarId,
      title: `${params.config.name ?? params.config.title} — ${params.leadName}`,
      description,
      date: params.fecha,
      startTime: params.hora,
      endTime: params.endTime,
      attendeeEmail: params.leadEmail,
      attendeeName: params.leadName,
      timezone: 'America/Bogota',
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
      metadata: { gcal_event_id: gcalEvent.id },
    })

    return { htmlLink: gcalEvent.htmlLink }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[create-booking] Google Calendar sync failed:`, errMsg)

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
