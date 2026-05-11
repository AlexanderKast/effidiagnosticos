# 🔄 Flujos y Lógica — Sistema de Agendamiento

> **Pseudocódigo, diagramas de decisión y casos edge.**

---

## 📑 Tabla de Contenidos

1. [Convenciones](#1-convenciones)
2. [FLUJO 1: Validación de disponibilidad](#2-flujo-1-validación-de-disponibilidad)
3. [FLUJO 2: Confirmar cita](#3-flujo-2-confirmar-cita)
4. [FLUJO 3: Sincronización con Google Calendar (async)](#4-flujo-3-sincronización-con-google-calendar-async)
5. [FLUJO 4: Reagendamiento](#5-flujo-4-reagendamiento)
6. [FLUJO 5: Cancelación](#6-flujo-5-cancelación)
7. [FLUJO 6: Worker de reintentos](#7-flujo-6-worker-de-reintentos)
8. [Funciones auxiliares](#8-funciones-auxiliares)

---

## 1. Convenciones

- **Pseudocódigo:** estilo TypeScript-like, sin tipos estrictos.
- **DB:** asumir cliente `supabase` ya inicializado.
- **Logs:** `logger.info | warn | error` con `request_id` siempre incluido.
- **Errores:** se lanzan como `AppError(code, message, status)`.

---

## 2. FLUJO 1: Validación de disponibilidad

### Diagrama

```
┌──────────────────────────────┐
│ POST /api/validate-          │
│   availability { fecha }     │
└────────────┬─────────────────┘
             │
             ▼
   ┌─────────────────────┐
   │ Validar input       │
   │ - fecha format      │
   │ - fecha >= hoy      │
   └─────────┬───────────┘
             │ ok
             ▼
   ┌─────────────────────┐
   │ ¿fecha es festivo?  │──Sí──▶ Return slots: []
   └─────────┬───────────┘
             │ no
             ▼
   ┌─────────────────────┐
   │ ¿domingo o sábado?  │──Sí──▶ Return slots: []
   └─────────┬───────────┘
             │ no
             ▼
   ┌──────────────────────────┐
   │ SELECT comerciales       │
   │ WHERE activo = TRUE      │
   └─────────┬────────────────┘
             │
             ▼
   ┌──────────────────────────┐
   │ Para cada comercial:     │
   │   - generar slots base   │
   │   - restar citas         │
   │   - excluir almuerzo     │
   └─────────┬────────────────┘
             │
             ▼
   ┌──────────────────────────┐
   │ Agregar slots (sum)      │
   │ Ordenar por hora         │
   └─────────┬────────────────┘
             │
             ▼
        Return slots
```

### Pseudocódigo

```typescript
async function validateAvailability(req) {
  const { fecha, duracion_min = 30, preferencia_horario = 'cualquiera' } = req.body
  const requestId = req.headers['x-request-id'] ?? generateRequestId()

  // PASO 1 — Validar fecha
  if (!isValidISODate(fecha)) {
    throw new AppError('INVALID_INPUT', 'fecha debe ser YYYY-MM-DD', 400)
  }

  const fechaDate = new Date(fecha + 'T00:00:00-05:00')   // Bogotá
  const hoy       = startOfDay(new Date(), 'America/Bogota')

  if (fechaDate < hoy) {
    throw new AppError('INVALID_DATE', 'La fecha está en el pasado', 400)
  }

  // PASO 2 — Verificar festivos
  const esFestivo = await supabase
    .from('holidays')
    .select('id')
    .eq('fecha', fecha)
    .eq('pais', 'Colombia')
    .maybeSingle()

  if (esFestivo.data) {
    logger.info('Fecha es festivo', { requestId, fecha, nombre: esFestivo.data.nombre })
    return { fecha, slots: [] }
  }

  // PASO 3 — Fin de semana
  const dia = fechaDate.getUTCDay()  // 0 = domingo, 6 = sábado
  if (dia === 0 || dia === 6) {
    return { fecha, slots: [] }
  }

  // PASO 4 — Obtener comerciales activos
  const { data: comerciales, error } = await supabase
    .from('comerciales')
    .select('id, nombre, max_citas_dia')
    .eq('activo', true)

  if (error) throw new AppError('INTERNAL_ERROR', error.message, 500)
  if (!comerciales || comerciales.length === 0) {
    return { fecha, slots: [] }
  }

  // PASO 5 — Para cada comercial, calcular slots disponibles
  const slotsByHora = new Map<string, number>()

  for (const comercial of comerciales) {
    const slotsBase = generarSlotsBase(duracion_min)        // ['09:00', '09:30', ..., '16:30']
    const ocupados  = await getCitasComercial(comercial.id, fecha)

    // Si el comercial ya alcanzó su tope, skipear
    if (ocupados.length >= comercial.max_citas_dia) continue

    for (const hora of slotsBase) {
      if (estaEnAlmuerzo(hora)) continue
      if (ocupados.find(o => o.hora === hora)) continue

      slotsByHora.set(hora, (slotsByHora.get(hora) ?? 0) + 1)
    }
  }

  // PASO 6 — Aplicar preferencia de horario
  let slots = Array.from(slotsByHora.entries()).map(([hora, count]) => ({
    hora,
    available: true,
    comercial_count: count
  }))

  if (preferencia_horario === 'manana') {
    slots = slots.filter(s => s.hora < '12:00')
  } else if (preferencia_horario === 'tarde') {
    slots = slots.filter(s => s.hora >= '13:00')
  }

  slots.sort((a, b) => a.hora.localeCompare(b.hora))

  return { fecha, timezone: 'America/Bogota', slots }
}
```

### Casos edge

| Caso | Comportamiento |
|------|----------------|
| `fecha` = ayer | Error `INVALID_DATE` |
| `fecha` = mañana pero festivo | Slots vacíos, success true |
| Sin comerciales activos | Slots vacíos, success true |
| Todos saturados (max_citas_dia) | Slots vacíos, success true |
| `duracion_min = 60` | Slots cada 60 min en vez de 30 |

---

## 3. FLUJO 2: Confirmar cita

### Diagrama

```
┌────────────────────────────────┐
│ POST /api/confirm-booking      │
└──────────────┬─────────────────┘
               │
               ▼
   ┌──────────────────────────┐
   │ Idempotency check        │──ya existe──▶ Return existing
   └──────────┬───────────────┘
              │ nuevo
              ▼
   ┌──────────────────────────┐
   │ Validar entrada (Zod)    │──fallo──▶ 400 INVALID_INPUT
   └──────────┬───────────────┘
              │ ok
              ▼
   ┌──────────────────────────┐
   │ Verificar slot disponible│──no──▶ 409 SLOT_TAKEN + sugerencias
   └──────────┬───────────────┘
              │ sí
              ▼
   ┌──────────────────────────┐
   │ Verificar duplicado      │──sí──▶ 409 DUPLICATE_BOOKING
   │ (email + fecha)          │
   └──────────┬───────────────┘
              │ no
              ▼
   ┌──────────────────────────┐
   │ Seleccionar comercial    │──no hay──▶ 422 NO_COMERCIAL_AVAILABLE
   │ (round-robin)            │
   └──────────┬───────────────┘
              │ ok
              ▼
   ┌──────────────────────────┐
   │ INSERT booking en        │
   │ transacción              │──falla──▶ ROLLBACK + 500
   └──────────┬───────────────┘
              │ ok
              ▼
   ┌──────────────────────────┐
   │ INSERT calendar_events   │
   │ (sync_status='pending')  │
   └──────────┬───────────────┘
              │
              ▼
   ┌──────────────────────────┐
   │ Disparar jobs async:     │
   │   - syncGoogle           │
   │   - sendEmail            │
   │   - sendWhatsapp         │
   └──────────┬───────────────┘
              │
              ▼
      Return 201 + datos
```

### Pseudocódigo

```typescript
async function confirmBooking(req) {
  const requestId    = req.headers['x-request-id'] ?? generateRequestId()
  const idempotencyKey = req.headers['idempotency-key']

  // PASO 1 — Idempotency
  if (idempotencyKey) {
    const existing = await supabase
      .from('bookings')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existing.data) {
      logger.info('Idempotent retry', { requestId, idempotencyKey })
      return formatBookingResponse(existing.data)
    }
  }

  // PASO 2 — Validar entrada con Zod
  const schema = z.object({
    nombre:       z.string().min(2).max(100),
    email:        z.string().email(),
    whatsapp:     z.string().regex(/^\+?\d{10,15}$/),
    empresa:      z.string().max(200).optional(),
    cargo:        z.string().max(100).optional(),
    ciudad:       z.string().max(100).optional(),
    fecha:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hora:         z.string().regex(/^\d{2}:\d{2}$/),
    duracion_min: z.number().int().min(15).max(120).optional(),
    notas:        z.string().max(1000).optional(),
    utm_source:   z.string().optional(),
    utm_medium:   z.string().optional(),
    utm_campaign: z.string().optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('INVALID_INPUT', parsed.error.message, 400)
  }
  const input = parsed.data

  // PASO 3 — Validar fecha (festivo, fin de semana, pasado)
  await assertFechaValida(input.fecha)

  // PASO 4 — Verificar slot disponible (re-check)
  const ocupado = await isSlotTaken(input.fecha, input.hora)
  if (ocupado.taken) {
    const sugerencias = await getSlotsCercanos(input.fecha, input.hora)
    throw new AppError('SLOT_TAKEN', 'El horario ya no está disponible', 409, {
      suggested_slots: sugerencias
    })
  }

  // PASO 5 — Verificar duplicado por email
  const duplicado = await supabase
    .from('bookings')
    .select('booking_id')
    .eq('email', input.email.toLowerCase())
    .eq('fecha', input.fecha)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle()

  if (duplicado.data) {
    throw new AppError('DUPLICATE_BOOKING', 'Ya existe una cita para este email en esta fecha', 409, {
      existing_booking_id: duplicado.data.booking_id
    })
  }

  // PASO 6 — Seleccionar comercial vía round-robin
  const comercial = await selectComercial(input.fecha, input.hora)
  if (!comercial) {
    throw new AppError('NO_COMERCIAL_AVAILABLE', 'No hay comerciales disponibles', 422)
  }

  // PASO 7 — INSERT booking
  const zoomLink = await crearZoomLink()   // o usar un link estático

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      comercial_id: comercial.id,
      nombre: input.nombre,
      email: input.email.toLowerCase(),
      whatsapp: input.whatsapp,
      empresa: input.empresa,
      cargo: input.cargo,
      ciudad: input.ciudad,
      fecha: input.fecha,
      hora: input.hora,
      duracion_min: input.duracion_min ?? 30,
      status: 'confirmed',
      zoom_link: zoomLink,
      utm_source: input.utm_source,
      utm_medium: input.utm_medium,
      utm_campaign: input.utm_campaign,
      origen: 'landing'
    })
    .select('*')
    .single()

  if (error) {
    logger.error('Failed to insert booking', { requestId, error })
    throw new AppError('INTERNAL_ERROR', 'No se pudo crear la cita', 500)
  }

  // PASO 8 — Crear calendar_events row (sync pending)
  await supabase.from('calendar_events').insert({
    booking_id: booking.id,
    google_calendar_id: comercial.google_calendar_id ?? process.env.GCAL_DEFAULT,
    sync_status: 'pending',
    payload: buildGoogleEventPayload(booking, comercial)
  })

  // PASO 9 — Disparar jobs asíncronos (fire and forget)
  setImmediate(async () => {
    try {
      await syncToGoogleCalendar(booking.id)
    } catch (e) {
      logger.error('Google sync failed', { requestId, bookingId: booking.id, e })
    }
  })

  setImmediate(async () => {
    try {
      await sendConfirmationEmail(booking, comercial)
    } catch (e) {
      logger.error('Email send failed', { requestId, bookingId: booking.id, e })
    }
  })

  setImmediate(async () => {
    try {
      await sendWhatsappConfirmation(booking)
    } catch (e) {
      logger.error('WhatsApp send failed', { requestId, bookingId: booking.id, e })
    }
  })

  // PASO 10 — Audit log
  await supabase.from('audit_log').insert({
    actor: 'system',
    action: 'create',
    resource_type: 'booking',
    resource_id: booking.id,
    payload_after: booking,
    ip_address: req.ip,
    user_agent: req.headers['user-agent']
  })

  // PASO 11 — Return
  return {
    booking_id: booking.booking_id,
    status: booking.status,
    fecha: booking.fecha,
    hora: booking.hora,
    comercial: { nombre: comercial.nombre, email: comercial.email },
    zoom_link: booking.zoom_link,
    calendar_status: 'syncing',
    email_sent: true,
    whatsapp_sent: true
  }
}
```

### Casos edge

| Caso | Comportamiento |
|------|----------------|
| Cliente envía 2 veces el mismo form (doble click) | `Idempotency-Key` devuelve el mismo booking |
| Cliente A y B intentan el mismo slot al mismo tiempo | Constraint UNIQUE en `bookings (fecha, hora, comercial_id)` gana uno, el otro recibe 409 |
| Google Calendar caído | Cita se crea, queda `sync_status = pending` |
| Gmail caído | Cita se crea, email queda en cola de reintento |
| Datos válidos pero ningún comercial activo | 422 `NO_COMERCIAL_AVAILABLE` |

---

## 4. FLUJO 3: Sincronización con Google Calendar (async)

### Pseudocódigo

```typescript
async function syncToGoogleCalendar(bookingId) {
  const { data: evt } = await supabase
    .from('calendar_events')
    .select('*, booking:bookings(*), comercial:bookings.comerciales(*)')
    .eq('booking_id', bookingId)
    .single()

  if (!evt) return
  if (evt.sync_status === 'synced') return   // ya hecho

  try {
    const gcal = getGoogleCalendarClient()

    const response = await gcal.events.insert({
      calendarId: evt.google_calendar_id,
      requestBody: evt.payload,
      sendUpdates: 'all'
    })

    await supabase
      .from('calendar_events')
      .update({
        google_event_id: response.data.id,
        sync_status: 'synced',
        last_sync_at: new Date().toISOString(),
        sync_attempts: evt.sync_attempts + 1
      })
      .eq('id', evt.id)

    logger.info('Google Calendar synced', { bookingId, googleEventId: response.data.id })
  } catch (err) {
    await supabase
      .from('calendar_events')
      .update({
        sync_status: 'failed',
        sync_attempts: evt.sync_attempts + 1,
        last_error: err.message,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', evt.id)

    logger.error('Google sync error', { bookingId, attempts: evt.sync_attempts + 1, err })

    // Si llevamos < 5 intentos, no reportar nada al cliente.
    // Si >= 5, alertar a admin.
    if (evt.sync_attempts + 1 >= 5) {
      await alertAdmin('Google sync failed 5 times', { bookingId, error: err.message })
    }
  }
}
```

### Política de reintentos

| Intento # | Espera antes de reintentar |
|-----------|----------------------------|
| 1 | inmediato |
| 2 | +30 segundos |
| 3 | +2 minutos |
| 4 | +10 minutos |
| 5 | +1 hora |
| 6+ | alertar admin, dejar de reintentar |

El worker (sección 7) maneja los reintentos.

---

## 5. FLUJO 4: Reagendamiento

```typescript
async function reschedule(bookingId, newFecha, newHora, motivo) {
  // 1. Obtener cita original
  const { data: original } = await supabase
    .from('bookings').select('*').eq('booking_id', bookingId).single()

  if (!original) throw new AppError('NOT_FOUND', 'Cita no existe', 404)
  if (original.status === 'cancelled') {
    throw new AppError('INVALID_INPUT', 'No se puede reagendar una cita cancelada', 400)
  }

  // 2. Verificar slot nuevo disponible
  const ocupado = await isSlotTaken(newFecha, newHora)
  if (ocupado.taken) throw new AppError('SLOT_TAKEN', '...', 409)

  // 3. Crear nuevo booking apuntando al viejo
  const { data: nuevo } = await supabase.from('bookings').insert({
    ...original,
    id: undefined,
    booking_id: undefined,         // se autogenera
    fecha: newFecha,
    hora: newHora,
    status: 'confirmed',
    rescheduled_from: original.id,
    notas: `Reagendado de ${original.fecha} ${original.hora}. Motivo: ${motivo}`,
    created_at: undefined,
    updated_at: undefined
  }).select('*').single()

  // 4. Marcar el original como rescheduled
  await supabase.from('bookings').update({
    status: 'rescheduled',
    cancelled_at: new Date().toISOString(),
    cancel_reason: `Reagendado a ${newFecha} ${newHora}`
  }).eq('id', original.id)

  // 5. Borrar evento viejo en Google y crear nuevo (ambos async)
  setImmediate(() => deleteGoogleEvent(original.id))
  setImmediate(() => syncToGoogleCalendar(nuevo.id))
  setImmediate(() => sendRescheduleEmail(nuevo, original))

  return { old_booking_id: original.booking_id, new_booking_id: nuevo.booking_id }
}
```

---

## 6. FLUJO 5: Cancelación

```typescript
async function cancel(bookingId, reason, cancelledBy) {
  const { data: booking } = await supabase
    .from('bookings').select('*').eq('booking_id', bookingId).single()

  if (!booking) throw new AppError('NOT_FOUND', '...', 404)
  if (booking.status === 'cancelled') return booking   // idempotente

  await supabase.from('bookings').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancelled_by: cancelledBy,
    cancel_reason: reason
  }).eq('id', booking.id)

  setImmediate(() => deleteGoogleEvent(booking.id))
  setImmediate(() => sendCancellationEmail(booking))

  return { booking_id: booking.booking_id, status: 'cancelled' }
}
```

---

## 7. FLUJO 6: Worker de reintentos

Cron que corre cada **5 minutos** en Vercel Cron o un VPS.

```typescript
// vercel.json
// "crons": [{ "path": "/api/jobs/retry-sync", "schedule": "*/5 * * * *" }]

async function retrySyncJob() {
  const ahora = new Date()

  // Tomar hasta 20 eventos con sync_status = 'failed' o 'pending'
  // y sync_attempts < 5
  const { data: pendientes } = await supabase
    .from('calendar_events')
    .select('*')
    .in('sync_status', ['pending', 'failed'])
    .lt('sync_attempts', 5)
    .order('updated_at', { ascending: true })
    .limit(20)

  for (const evt of pendientes ?? []) {
    const espera = backoffSeconds(evt.sync_attempts)
    const proximo = new Date(new Date(evt.last_sync_at ?? evt.created_at).getTime() + espera * 1000)

    if (proximo > ahora) continue   // aún muy pronto

    await syncToGoogleCalendar(evt.booking_id)
  }
}

function backoffSeconds(attempts) {
  switch (attempts) {
    case 0: return 0
    case 1: return 30
    case 2: return 120
    case 3: return 600
    case 4: return 3600
    default: return Number.MAX_SAFE_INTEGER
  }
}
```

---

## 8. Funciones auxiliares

### 8.1 `selectComercial` — Round Robin

```typescript
async function selectComercial(fecha, hora) {
  // Comerciales activos
  const { data: comerciales } = await supabase
    .from('comerciales')
    .select('*')
    .eq('activo', true)
    .order('prioridad', { ascending: true })

  if (!comerciales || comerciales.length === 0) return null

  // Filtrar los que ya tienen cita a esa hora o están saturados ese día
  const candidatos = []
  for (const c of comerciales) {
    const { count: hoy } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('comercial_id', c.id)
      .eq('fecha', fecha)
      .in('status', ['confirmed', 'pending'])

    if (hoy >= c.max_citas_dia) continue

    const { data: choque } = await supabase
      .from('bookings')
      .select('id')
      .eq('comercial_id', c.id)
      .eq('fecha', fecha)
      .eq('hora', hora)
      .in('status', ['confirmed', 'pending'])
      .maybeSingle()

    if (choque) continue

    candidatos.push({ ...c, citasHoy: hoy })
  }

  if (candidatos.length === 0) return null

  // Round-robin = el que tiene MENOS citas hoy gana
  candidatos.sort((a, b) => a.citasHoy - b.citasHoy)
  return candidatos[0]
}
```

### 8.2 `generarSlotsBase`

```typescript
function generarSlotsBase(duracionMin = 30) {
  const slots = []
  for (let m = 9 * 60; m < 17 * 60; m += duracionMin) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    slots.push(`${hh}:${mm}`)
  }
  return slots
}
```

### 8.3 `estaEnAlmuerzo`

```typescript
function estaEnAlmuerzo(hora) {
  return hora >= '12:00' && hora < '13:00'
}
```

### 8.4 `isSlotTaken`

```typescript
async function isSlotTaken(fecha, hora) {
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('fecha', fecha)
    .eq('hora', hora)
    .in('status', ['confirmed', 'pending'])

  return { taken: (count ?? 0) > 0, count }
}
```

### 8.5 `getSlotsCercanos`

```typescript
async function getSlotsCercanos(fecha, hora) {
  const todos = generarSlotsBase(30)
  const idx = todos.indexOf(hora)
  if (idx < 0) return []

  // 3 antes, 3 después
  const candidatos = [
    ...todos.slice(Math.max(0, idx - 3), idx),
    ...todos.slice(idx + 1, idx + 4)
  ].filter(h => !estaEnAlmuerzo(h))

  const libres = []
  for (const h of candidatos) {
    const { taken } = await isSlotTaken(fecha, h)
    if (!taken) libres.push(h)
  }
  return libres.slice(0, 3)
}
```

### 8.6 `assertFechaValida`

```typescript
async function assertFechaValida(fecha) {
  const f = new Date(fecha + 'T00:00:00-05:00')
  const hoy = startOfDay(new Date(), 'America/Bogota')

  if (f < hoy)         throw new AppError('INVALID_DATE', 'fecha en pasado', 400)
  if (f.getUTCDay() === 0 || f.getUTCDay() === 6) {
    throw new AppError('INVALID_DATE', 'fin de semana', 400)
  }

  const { data: festivo } = await supabase
    .from('holidays').select('id').eq('fecha', fecha).maybeSingle()
  if (festivo) throw new AppError('INVALID_DATE', 'fecha es festivo', 400)
}
```

### 8.7 `buildGoogleEventPayload`

```typescript
function buildGoogleEventPayload(booking, comercial) {
  const start = `${booking.fecha}T${booking.hora}:00-05:00`
  const end   = addMinutes(start, booking.duracion_min)

  return {
    summary: `Cita Effi — ${booking.nombre} (${booking.empresa ?? 'Sin empresa'})`,
    description: [
      `Cliente: ${booking.nombre}`,
      `Email: ${booking.email}`,
      `WhatsApp: ${booking.whatsapp}`,
      `Empresa: ${booking.empresa ?? '—'}`,
      `Notas: ${booking.notas ?? '—'}`,
      ``,
      `Booking ID: ${booking.booking_id}`,
      `Zoom: ${booking.zoom_link}`
    ].join('\n'),
    start: { dateTime: start, timeZone: 'America/Bogota' },
    end:   { dateTime: end,   timeZone: 'America/Bogota' },
    attendees: [
      { email: comercial.email, responseStatus: 'accepted' },
      { email: booking.email,   responseStatus: 'needsAction' }
    ],
    conferenceData: {
      createRequest: {
        requestId: booking.booking_id,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 },   // 1 día antes
        { method: 'popup', minutes: 15 }
      ]
    }
  }
}
```

---

## 📚 Documentos relacionados

- [`ENDPOINTS_API.md`](./ENDPOINTS_API.md)
- [`SCHEMA_SUPABASE.md`](./SCHEMA_SUPABASE.md)
- [`INTEGRACIONES_EXTERNAS.md`](./INTEGRACIONES_EXTERNAS.md)
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md)
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
