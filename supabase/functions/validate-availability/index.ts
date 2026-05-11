import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const RequestSchema = z.object({
  booking_id: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD'),
})

interface TimeSlot {
  time: string         // "09:00"
  available: boolean
  label: string        // "9:00 AM"
}

async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/google-token-refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
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

async function getGoogleBusySlots(
  accessToken: string,
  calendarId: string,
  fecha: string,
  timezone: string
): Promise<Array<{ start: string; end: string }>> {
  const dayStart = `${fecha}T00:00:00`
  const dayEnd = `${fecha}T23:59:59`

  const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: new Date(`${dayStart}Z`).toISOString(),
      timeMax: new Date(`${dayEnd}Z`).toISOString(),
      timeZone: timezone,
      items: [{ id: calendarId }],
    }),
  })

  if (!resp.ok) {
    console.error('[validate-availability] Google freeBusy failed:', resp.status)
    return []
  }

  const data = await resp.json()
  return data.calendars?.[calendarId]?.busy ?? []
}

function generateSlots(
  fecha: string,
  duration: number,
  busySlots: Array<{ start: string; end: string }>,
  existingAppointments: Array<{ start_time: string; end_time: string }>
): TimeSlot[] {
  const WORK_START = 8   // 8am
  const WORK_END = 18    // 6pm
  const slots: TimeSlot[] = []

  const now = new Date()
  const isToday = fecha === now.toISOString().split('T')[0]

  for (let hour = WORK_START; hour < WORK_END; hour++) {
    for (let min = 0; min < 60; min += duration) {
      const startMinutes = hour * 60 + min
      const endMinutes = startMinutes + duration

      if (endMinutes > WORK_END * 60) break

      const startStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      const endStr = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`

      // Skip past slots if today
      if (isToday) {
        const slotDate = new Date(`${fecha}T${startStr}:00`)
        if (slotDate <= now) continue
      }

      // Check against Google Calendar busy slots
      const blockedByGoogle = busySlots.some((busy) => {
        const busyStart = new Date(busy.start)
        const busyEnd = new Date(busy.end)
        const slotStart = new Date(`${fecha}T${startStr}:00`)
        const slotEnd = new Date(`${fecha}T${endStr}:00`)
        return slotStart < busyEnd && slotEnd > busyStart
      })

      // Check against existing Supabase appointments
      const blockedByDB = existingAppointments.some((appt) => {
        return startStr < appt.end_time && endStr > appt.start_time
      })

      const available = !blockedByGoogle && !blockedByDB

      // Format label: "9:00 AM"
      const labelHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
      const ampm = hour < 12 ? 'AM' : 'PM'
      const label = `${labelHour}:${String(min).padStart(2, '0')} ${ampm}`

      slots.push({ time: startStr, available, label })
    }
  }

  return slots
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const requestId = crypto.randomUUID()

  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { success: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const { booking_id, fecha } = parsed.data

    // Validate date is not in the past
    const today = new Date().toISOString().split('T')[0]
    if (fecha < today) {
      return Response.json(
        { success: false, error: 'La fecha no puede ser en el pasado' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Get booking config (duration + calendar ID del comercial)
    const { data: config, error: configError } = await supabase
      .from('booking_configs')
      .select('booking_id, duration, active, gcal_calendar_id')
      .eq('booking_id', booking_id)
      .single()

    if (configError || !config) {
      return Response.json(
        { success: false, error: 'Booking no encontrado' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    if (!config.active) {
      return Response.json(
        { success: false, error: 'Este booking no está disponible' },
        { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Get existing appointments from Supabase
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('booking_id', booking_id)
      .eq('appointment_date', fecha)
      .in('status', ['pending', 'confirmed'])

    // Try to get Google Calendar busy slots (graceful degradation if fails)
    // Usa el calendario del comercial al que tu cuenta principal tiene acceso
    const calendarId = config.gcal_calendar_id ?? 'primary'
    const accessToken = await getGoogleAccessToken()
    const busySlots = accessToken
      ? await getGoogleBusySlots(accessToken, calendarId, fecha, 'America/Bogota')
      : []

    const slots = generateSlots(
      fecha,
      config.duration,
      busySlots,
      existingAppointments ?? []
    )

    return Response.json(
      {
        success: true,
        data: {
          fecha,
          booking_id,
          duration: config.duration,
          slots,
          source: accessToken ? 'google+supabase' : 'supabase',
        },
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    console.error(`[validate-availability][${requestId}]`, err)
    return Response.json(
      { success: false, error: 'Error interno del servidor', request_id: requestId },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
