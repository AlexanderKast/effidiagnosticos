import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface TimeSlot {
  time: string      // "09:00"
  available: boolean
  label: string     // "9:00 AM"
}

interface BusyPeriod {
  start: string
  end: string
}

// ---------------------------------------------------------------------------
// Helpers de zona horaria Colombia (UTC-5, sin DST)
// ---------------------------------------------------------------------------

/** Devuelve la hora actual en Colombia como objeto con campos UTC ajustados */
function nowColombia(): { year: number; month: number; day: number; hours: number; minutes: number } {
  const now = new Date()
  // Restar 5 horas para obtener la hora en Colombia
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  return {
    year: col.getUTCFullYear(),
    month: col.getUTCMonth(), // 0-indexed
    day: col.getUTCDate(),
    hours: col.getUTCHours(),
    minutes: col.getUTCMinutes(),
  }
}

/** Verifica si una fecha YYYY-MM-DD es hoy en Colombia */
function isTodayColombia(fecha: string): boolean {
  const col = nowColombia()
  const [year, month, day] = fecha.split('-').map(Number)
  return year === col.year && month === col.month + 1 && day === col.day
}

/** Verifica si una fecha YYYY-MM-DD es pasada en Colombia */
function isPastColombia(fecha: string): boolean {
  const col = nowColombia()
  const todayStr = `${col.year}-${String(col.month + 1).padStart(2, '0')}-${String(col.day).padStart(2, '0')}`
  return fecha < todayStr
}

/** Devuelve el día de la semana en Colombia (0=domingo, 6=sábado) */
function dayOfWeekColombia(fecha: string): number {
  // Construimos la fecha a mediodía Colombia para evitar desfases
  const d = new Date(`${fecha}T12:00:00-05:00`)
  return d.getDay()
}

// ---------------------------------------------------------------------------
// Google OAuth token
// ---------------------------------------------------------------------------

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
    return access_token ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Google Calendar freeBusy — un solo calendario
// ---------------------------------------------------------------------------

async function getFreeBusySingle(
  accessToken: string,
  calendarId: string,
  fecha: string
): Promise<BusyPeriod[]> {
  const timeMin = `${fecha}T00:00:00-05:00`
  const timeMax = `${fecha}T23:59:59-05:00`

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
      console.error('[validate-availability] freeBusy single failed:', resp.status, await resp.text())
      return []
    }

    const data = await resp.json()
    return data.calendars?.[calendarId]?.busy ?? []
  } catch (err) {
    console.error('[validate-availability] freeBusy single error:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Google Calendar freeBusy — múltiples calendarios (group)
// Retorna un Map<calendarId, BusyPeriod[]>
// ---------------------------------------------------------------------------

async function getFreeBusyMultiple(
  accessToken: string,
  calendarIds: string[],
  fecha: string
): Promise<Map<string, BusyPeriod[]>> {
  const timeMin = `${fecha}T00:00:00-05:00`
  const timeMax = `${fecha}T23:59:59-05:00`

  const result = new Map<string, BusyPeriod[]>()

  if (calendarIds.length === 0) return result

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
        items: calendarIds.map((id) => ({ id })),
      }),
    })

    if (!resp.ok) {
      console.error('[validate-availability] freeBusy multiple failed:', resp.status, await resp.text())
      // Inicializar vacío para cada miembro
      calendarIds.forEach((id) => result.set(id, []))
      return result
    }

    const data = await resp.json()
    calendarIds.forEach((id) => {
      result.set(id, data.calendars?.[id]?.busy ?? [])
    })
    return result
  } catch (err) {
    console.error('[validate-availability] freeBusy multiple error:', err)
    calendarIds.forEach((id) => result.set(id, []))
    return result
  }
}

// ---------------------------------------------------------------------------
// Verificar si un slot está bloqueado por busy periods de Google Calendar
// ---------------------------------------------------------------------------

function isSlotBusy(busyPeriods: BusyPeriod[], fecha: string, slotStart: string, slotEnd: string): boolean {
  const slotStartMs = new Date(`${fecha}T${slotStart}:00-05:00`).getTime()
  const slotEndMs = new Date(`${fecha}T${slotEnd}:00-05:00`).getTime()

  return busyPeriods.some((busy) => {
    const busyStartMs = new Date(busy.start).getTime()
    const busyEndMs = new Date(busy.end).getTime()
    // Overlap: slotStart < busyEnd AND slotEnd > busyStart
    return slotStartMs < busyEndMs && slotEndMs > busyStartMs
  })
}

// ---------------------------------------------------------------------------
// Generador de slots según la lógica exacta de N8N
// 09:00-12:00 cada 30min + 13:00-17:00 cada 30min = 14 slots
// ---------------------------------------------------------------------------

interface SlotRange {
  startHour: number
  endHour: number
}

const SLOT_RANGES: SlotRange[] = [
  { startHour: 9, endHour: 12 },   // 09:00 → 11:30 (último inicia a las 11:30)
  { startHour: 13, endHour: 17 },  // 13:00 → 16:30 (último inicia a las 16:30)
]

const SLOT_DURATION_MINUTES = 30

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Genera la lista base de slots para el día (sin filtros de disponibilidad) */
function generateBaseSlots(): Array<{ time: string; endTime: string; label: string }> {
  const slots: Array<{ time: string; endTime: string; label: string }> = []

  for (const range of SLOT_RANGES) {
    for (let hour = range.startHour; hour < range.endHour; hour++) {
      for (let min = 0; min < 60; min += SLOT_DURATION_MINUTES) {
        const startMinutes = hour * 60 + min
        const endMinutes = startMinutes + SLOT_DURATION_MINUTES

        // El slot no puede terminar después del límite de la franja
        if (endMinutes > range.endHour * 60) break

        const startStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
        const endStr = addMinutes(startStr, SLOT_DURATION_MINUTES)

        slots.push({ time: startStr, endTime: endStr, label: formatLabel(startStr) })
      }
    }
  }

  return slots
}

// ---------------------------------------------------------------------------
// Filtro: anticipación mínima de 4 horas para slots de hoy (Colombia)
// ---------------------------------------------------------------------------

function passesLeadTimeFilter(fecha: string, slotTime: string): boolean {
  if (!isTodayColombia(fecha)) return true

  const col = nowColombia()
  const [slotH, slotM] = slotTime.split(':').map(Number)

  // Minutos totales actuales en Colombia
  const nowMinutes = col.hours * 60 + col.minutes
  // Minutos del slot
  const slotMinutes = slotH * 60 + slotM

  // El slot debe tener al menos 4 horas de anticipación
  return slotMinutes >= nowMinutes + 4 * 60
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

    // -----------------------------------------------------------------------
    // 2. Rechazar fines de semana
    // -----------------------------------------------------------------------
    const dow = dayOfWeekColombia(fecha)
    if (dow === 0 || dow === 6) {
      return Response.json(
        {
          success: true,
          data: {
            fecha,
            booking_id,
            slots: [],
            available: false,
            reason: 'No hay atención los fines de semana',
          },
        },
        { headers: CORS_HEADERS }
      )
    }

    // -----------------------------------------------------------------------
    // 3. Rechazar fechas pasadas (comparación en Colombia)
    // -----------------------------------------------------------------------
    if (isPastColombia(fecha)) {
      return Response.json(
        {
          success: true,
          data: {
            fecha,
            booking_id,
            slots: [],
            available: false,
            reason: 'La fecha ya pasó',
          },
        },
        { headers: CORS_HEADERS }
      )
    }

    // -----------------------------------------------------------------------
    // 4. Obtener configuración del booking
    // -----------------------------------------------------------------------
    const { data: config, error: configError } = await supabase
      .from('booking_configs')
      .select('booking_id, duration, active, gcal_calendar_id, assignment_type, commercial_group_id')
      .eq('booking_id', booking_id)
      .single()

    if (configError || !config) {
      return Response.json(
        { success: false, error: 'Booking no encontrado' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    if (!config.active) {
      return Response.json(
        { success: false, error: 'Este booking no está disponible' },
        { status: 404, headers: CORS_HEADERS }
      )
    }

    // -----------------------------------------------------------------------
    // 5. Obtener token de Google (degradación graceful si falla)
    // -----------------------------------------------------------------------
    const accessToken = await getGoogleAccessToken()

    // -----------------------------------------------------------------------
    // 6. Obtener busy periods de Google Calendar según assignment_type
    // -----------------------------------------------------------------------
    const assignmentType: string = config.assignment_type ?? 'individual'

    // busyByCal: para group, Map de calendarId → BusyPeriod[]
    // busySingle: para individual, array directo
    let busySingle: BusyPeriod[] = []
    let busyByCal: Map<string, BusyPeriod[]> = new Map()

    // Para group: obtener miembros activos con sus calendar_ids
    let groupMembers: Array<{ id: string; calendar_id: string; name: string; email: string }> = []

    if (assignmentType === 'group' && config.commercial_group_id) {
      const { data: members, error: membersError } = await supabase
        .from('commercial_group_members')
        .select(`
          commercial_id,
          commercial_calendars!inner(
            id,
            calendar_id,
            name,
            email,
            status
          )
        `)
        .eq('group_id', config.commercial_group_id)
        .eq('commercial_calendars.status', 'active')

      if (!membersError && members && members.length > 0) {
        groupMembers = members.map((m: Record<string, unknown>) => {
          const cal = m.commercial_calendars as Record<string, unknown>
          return {
            id: cal.id as string,
            calendar_id: cal.calendar_id as string,
            name: cal.name as string,
            email: cal.email as string,
          }
        })

        if (accessToken && groupMembers.length > 0) {
          const calIds = groupMembers.map((m) => m.calendar_id)
          busyByCal = await getFreeBusyMultiple(accessToken, calIds, fecha)
        }
      }
    } else {
      // Individual
      const calendarId: string = config.gcal_calendar_id ?? 'primary'
      if (accessToken) {
        busySingle = await getFreeBusySingle(accessToken, calendarId, fecha)
      }
    }

    // -----------------------------------------------------------------------
    // 7. Obtener appointments confirmados en DB (para ambos tipos)
    // -----------------------------------------------------------------------
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('booking_id', booking_id)
      .eq('appointment_date', fecha)
      .in('status', ['pending', 'confirmed'])

    const dbAppointments = (existingAppointments ?? []) as Array<{ start_time: string; end_time: string }>

    // -----------------------------------------------------------------------
    // 8. Generar slots con disponibilidad
    // -----------------------------------------------------------------------
    const baseSlots = generateBaseSlots()
    const slots: TimeSlot[] = []

    for (const slot of baseSlots) {
      // Filtro de anticipación mínima para hoy
      if (!passesLeadTimeFilter(fecha, slot.time)) {
        // No incluimos slots pasados del día de hoy
        continue
      }

      // Bloqueado por DB
      const blockedByDB = dbAppointments.some(
        (appt) => slot.time < appt.end_time && slot.endTime > appt.start_time
      )

      let available: boolean

      if (assignmentType === 'group' && groupMembers.length > 0) {
        // Un slot está disponible si AL MENOS UN miembro está libre en Google
        // (y no está bloqueado en DB global del booking)
        if (blockedByDB) {
          available = false
        } else if (!accessToken || busyByCal.size === 0) {
          // Sin token: asumir disponible (degradación graceful)
          available = true
        } else {
          // Verificar si al menos un miembro está libre
          available = groupMembers.some((member) => {
            const memberBusy = busyByCal.get(member.calendar_id) ?? []
            return !isSlotBusy(memberBusy, fecha, slot.time, slot.endTime)
          })
        }
      } else {
        // Individual
        const blockedByGoogle = accessToken
          ? isSlotBusy(busySingle, fecha, slot.time, slot.endTime)
          : false
        available = !blockedByGoogle && !blockedByDB
      }

      slots.push({ time: slot.time, available, label: slot.label })
    }

    // -----------------------------------------------------------------------
    // 9. Respuesta
    // -----------------------------------------------------------------------
    const hasAvailable = slots.some((s) => s.available)

    return Response.json(
      {
        success: true,
        data: {
          fecha,
          booking_id,
          assignment_type: assignmentType,
          slots,
          available: hasAvailable,
          source: accessToken ? 'google+supabase' : 'supabase',
        },
      },
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error(`[validate-availability][${requestId}]`, err)
    return Response.json(
      { success: false, error: 'Error interno del servidor', request_id: requestId },
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
