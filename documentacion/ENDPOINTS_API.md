# 🔌 Endpoints API — Sistema de Agendamiento

> **Especificación completa de cada endpoint REST.**

---

## 📑 Tabla de Contenidos

1. [Convenciones generales](#1-convenciones-generales)
2. [Autenticación](#2-autenticación)
3. [Códigos de error globales](#3-códigos-de-error-globales)
4. [POST `/api/validate-availability`](#4-post-apivalidate-availability)
5. [POST `/api/confirm-booking`](#5-post-apiconfirm-booking)
6. [GET `/api/bookings`](#6-get-apibookings)
7. [GET `/api/bookings/:booking_id`](#7-get-apibookingsbooking_id)
8. [PUT `/api/bookings/:booking_id`](#8-put-apibookingsbooking_id)
9. [DELETE `/api/bookings/:booking_id`](#9-delete-apibookingsbooking_id)
10. [GET `/api/health`](#10-get-apihealth)

---

## 1. Convenciones generales

- **Base URL (prod):** `https://api.effidiagnosticos.com`
- **Base URL (dev):** `http://localhost:8080`
- **Formato:** `application/json` (request y response)
- **Encoding:** `UTF-8`
- **Timezone:** todas las fechas en `America/Bogota` salvo que se indique otra
- **Versionado:** prefijo `/api/v1/` recomendado a futuro; v1 implícita hoy
- **Idempotencia:** `POST /confirm-booking` acepta header `Idempotency-Key`

### Estructura de respuesta exitosa

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-05-11T15:30:00.000Z",
    "request_id": "req_a1b2c3d4"
  }
}
```

### Estructura de respuesta con error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DATE",
    "message": "La fecha proporcionada está en el pasado",
    "field": "fecha",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-05-11T15:30:00.000Z",
    "request_id": "req_a1b2c3d4"
  }
}
```

---

## 2. Autenticación

### Endpoints públicos
- `POST /api/validate-availability` — público (rate limited)
- `POST /api/confirm-booking` — público (rate limited)
- `GET /api/health` — público

### Endpoints privados (requieren JWT)
- `GET /api/bookings`
- `GET /api/bookings/:booking_id`
- `PUT /api/bookings/:booking_id`
- `DELETE /api/bookings/:booking_id`

**Header esperado:**

```
Authorization: Bearer eyJhbGciOi...
```

El JWT se obtiene del Supabase Auth del comercial.

---

## 3. Códigos de error globales

| Código HTTP | `error.code` | Significado |
|------------|--------------|-------------|
| 400 | `INVALID_INPUT` | Cualquier campo inválido |
| 400 | `INVALID_DATE` | Fecha fuera de rango / festivo / fin de semana |
| 400 | `INVALID_EMAIL` | Email mal formado |
| 400 | `INVALID_WHATSAPP` | WhatsApp inválido |
| 401 | `UNAUTHORIZED` | Falta o expiró el token |
| 403 | `FORBIDDEN` | Token válido, sin permiso |
| 404 | `NOT_FOUND` | Recurso no existe |
| 409 | `SLOT_TAKEN` | Slot ya reservado por otro |
| 409 | `DUPLICATE_BOOKING` | Mismo email, misma fecha |
| 422 | `NO_COMERCIAL_AVAILABLE` | No hay comerciales para asignar |
| 429 | `RATE_LIMIT` | Exceso de requests |
| 500 | `INTERNAL_ERROR` | Error no manejado |
| 503 | `DEPENDENCY_DOWN` | Supabase/Gmail/Google caído |

---

## 4. POST `/api/validate-availability`

> **Devuelve los slots disponibles para una fecha dada.**

### Descripción

Calcula la disponibilidad de slots en una fecha específica, considerando:
- Comerciales activos
- Citas existentes
- Bloqueo de almuerzo (12:00-13:00)
- Festivos y fines de semana

No persiste nada en la BD (lectura pura), pero puede crear un soft-lock opcional.

### Request

**Headers:**
```
Content-Type: application/json
X-Request-ID: opcional, generado por cliente
```

**Body:**
```json
{
  "fecha": "2026-05-15",
  "timezone": "America/Bogota",
  "duracion_min": 30,
  "preferencia_horario": "manana"
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `fecha` | string (YYYY-MM-DD) | ✅ | >= hoy, no festivo, no domingo |
| `timezone` | string | ❌ | default `America/Bogota` |
| `duracion_min` | integer | ❌ | default 30, max 120 |
| `preferencia_horario` | enum | ❌ | `manana` \| `tarde` \| `cualquiera` |

### Validaciones

1. `fecha` debe ser >= `CURRENT_DATE`.
2. `fecha` no puede ser sábado o domingo (a menos que se habilite expresamente).
3. `fecha` no puede estar en `holidays`.
4. `duracion_min` entre 15 y 120.

### Response 200 — Éxito

```json
{
  "success": true,
  "data": {
    "fecha": "2026-05-15",
    "timezone": "America/Bogota",
    "slots": [
      { "hora": "09:00", "available": true, "comercial_count": 2 },
      { "hora": "09:30", "available": true, "comercial_count": 2 },
      { "hora": "10:00", "available": false, "reason": "taken" },
      { "hora": "10:30", "available": true, "comercial_count": 1 },
      { "hora": "11:00", "available": true, "comercial_count": 2 },
      { "hora": "11:30", "available": true, "comercial_count": 2 },
      { "hora": "13:00", "available": true, "comercial_count": 2 },
      { "hora": "13:30", "available": true, "comercial_count": 2 },
      { "hora": "14:00", "available": true, "comercial_count": 1 },
      { "hora": "14:30", "available": true, "comercial_count": 2 },
      { "hora": "15:00", "available": true, "comercial_count": 2 },
      { "hora": "15:30", "available": false, "reason": "taken" },
      { "hora": "16:00", "available": true, "comercial_count": 2 },
      { "hora": "16:30", "available": true, "comercial_count": 2 }
    ]
  },
  "meta": {
    "timestamp": "2026-05-11T15:30:00.000Z",
    "request_id": "req_a1b2c3d4"
  }
}
```

### Response 400 — Fecha inválida

```json
{
  "success": false,
  "error": {
    "code": "INVALID_DATE",
    "message": "La fecha 2026-05-17 es domingo, no hay atención",
    "field": "fecha"
  }
}
```

### Response 422 — Sin disponibilidad

```json
{
  "success": true,
  "data": {
    "fecha": "2026-05-15",
    "slots": []
  }
}
```

> Nota: el código de éxito sigue siendo 200 porque la consulta fue válida; el resultado simplemente es vacío.

### Ejemplos de uso

**cURL:**
```bash
curl -X POST https://api.effidiagnosticos.com/api/validate-availability \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-05-15"}'
```

**JavaScript (fetch):**
```js
const res = await fetch('/api/validate-availability', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fecha: '2026-05-15' })
});
const { data } = await res.json();
console.log(data.slots);
```

**Python:**
```python
import requests

r = requests.post(
    "https://api.effidiagnosticos.com/api/validate-availability",
    json={"fecha": "2026-05-15"}
)
print(r.json()["data"]["slots"])
```

---

## 5. POST `/api/confirm-booking`

> **Crea una cita confirmada.**

### Descripción

Punto crítico del sistema. Crea una cita en `bookings`, asigna comercial vía round-robin, dispara sincronización asíncrona con Google Calendar, envía email y WhatsApp.

**Es idempotente:** si se envía el mismo `Idempotency-Key`, devuelve la cita ya creada sin duplicar.

### Request

**Headers:**
```
Content-Type: application/json
Idempotency-Key: idemp_a1b2c3   (opcional pero recomendado)
```

**Body:**
```json
{
  "nombre": "Juan Pérez",
  "email": "juan.perez@empresa.com",
  "whatsapp": "+573001234567",
  "empresa": "Acme S.A.S.",
  "cargo": "Gerente Comercial",
  "ciudad": "Medellín",
  "fecha": "2026-05-15",
  "hora": "10:30",
  "duracion_min": 30,
  "notas": "Interesado en plan empresarial",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "lanzamiento-2026"
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `nombre` | string | ✅ | 2-100 chars |
| `email` | string | ✅ | Regex email |
| `whatsapp` | string | ✅ | E.164, 10-15 dígitos |
| `empresa` | string | ❌ | max 200 chars |
| `cargo` | string | ❌ | max 100 chars |
| `ciudad` | string | ❌ | max 100 chars |
| `fecha` | string | ✅ | YYYY-MM-DD, >= hoy |
| `hora` | string | ✅ | HH:MM, slot válido |
| `duracion_min` | integer | ❌ | default 30 |
| `notas` | string | ❌ | max 1000 chars |
| `utm_*` | string | ❌ | tracking |

### Response 201 — Cita creada

```json
{
  "success": true,
  "data": {
    "booking_id": "EFFI-2026-001234",
    "status": "confirmed",
    "fecha": "2026-05-15",
    "hora": "10:30",
    "duracion_min": 30,
    "comercial": {
      "nombre": "Laura Gómez",
      "email": "laura@effidiagnosticos.com"
    },
    "zoom_link": "https://zoom.us/j/123456789",
    "calendar_status": "syncing",
    "email_sent": true,
    "whatsapp_sent": true
  },
  "meta": {
    "timestamp": "2026-05-11T15:30:00.000Z",
    "request_id": "req_a1b2c3d4"
  }
}
```

### Response 409 — Slot tomado

```json
{
  "success": false,
  "error": {
    "code": "SLOT_TAKEN",
    "message": "El horario solicitado ya no está disponible",
    "field": "hora",
    "details": {
      "fecha": "2026-05-15",
      "hora": "10:30",
      "suggested_slots": ["11:00", "11:30", "14:00"]
    }
  }
}
```

### Response 409 — Duplicado

```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_BOOKING",
    "message": "Ya existe una cita para este email en esta fecha",
    "details": {
      "existing_booking_id": "EFFI-2026-001100"
    }
  }
}
```

### Response 422 — Sin comercial disponible

```json
{
  "success": false,
  "error": {
    "code": "NO_COMERCIAL_AVAILABLE",
    "message": "Todos los comerciales están saturados para esa fecha"
  }
}
```

### Ejemplos de uso

**cURL:**
```bash
curl -X POST https://api.effidiagnosticos.com/api/confirm-booking \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: idemp_$(uuidgen)" \
  -d '{
    "nombre":"Juan Pérez",
    "email":"juan@empresa.com",
    "whatsapp":"+573001234567",
    "fecha":"2026-05-15",
    "hora":"10:30",
    "empresa":"Acme"
  }'
```

**JavaScript (fetch):**
```js
const idempKey = crypto.randomUUID();

const res = await fetch('/api/confirm-booking', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempKey
  },
  body: JSON.stringify({
    nombre: 'Juan Pérez',
    email: 'juan@empresa.com',
    whatsapp: '+573001234567',
    fecha: '2026-05-15',
    hora: '10:30',
    empresa: 'Acme'
  })
});

if (res.ok) {
  const { data } = await res.json();
  window.location.href = `/confirmacion/${data.booking_id}`;
} else {
  const { error } = await res.json();
  alert(error.message);
}
```

---

## 6. GET `/api/bookings`

> **Lista citas (privado).**

### Query params

| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `from` | date | hoy | Fecha desde |
| `to` | date | hoy + 30d | Fecha hasta |
| `comercial_id` | uuid | all | Filtra por comercial |
| `status` | enum | all | `pending`, `confirmed`, etc |
| `page` | int | 1 | Paginación |
| `per_page` | int | 50 | Max 200 |

### Response 200

```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "booking_id": "EFFI-2026-001234",
        "nombre": "Juan Pérez",
        "email": "juan@empresa.com",
        "fecha": "2026-05-15",
        "hora": "10:30",
        "status": "confirmed",
        "comercial": { "nombre": "Laura Gómez" }
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 50,
      "total": 234,
      "total_pages": 5
    }
  }
}
```

### Ejemplo

```bash
curl https://api.effidiagnosticos.com/api/bookings?from=2026-05-01&to=2026-05-31 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 7. GET `/api/bookings/:booking_id`

> **Detalle completo de una cita.**

### Response 200

```json
{
  "success": true,
  "data": {
    "booking_id": "EFFI-2026-001234",
    "status": "confirmed",
    "nombre": "Juan Pérez",
    "email": "juan@empresa.com",
    "whatsapp": "+573001234567",
    "empresa": "Acme S.A.S.",
    "cargo": "Gerente Comercial",
    "ciudad": "Medellín",
    "fecha": "2026-05-15",
    "hora": "10:30",
    "duracion_min": 30,
    "zoom_link": "https://zoom.us/j/123456789",
    "comercial": {
      "id": "uuid",
      "nombre": "Laura Gómez",
      "email": "laura@effidiagnosticos.com"
    },
    "calendar_event": {
      "google_event_id": "abc123",
      "sync_status": "synced",
      "last_sync_at": "2026-05-11T15:30:05.000Z"
    },
    "audit_trail": [
      { "action": "create", "at": "2026-05-11T15:30:00.000Z" },
      { "action": "sync",   "at": "2026-05-11T15:30:05.000Z" }
    ],
    "created_at": "2026-05-11T15:30:00.000Z",
    "updated_at": "2026-05-11T15:30:05.000Z"
  }
}
```

### Response 404

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "No existe cita con booking_id EFFI-2026-999999"
  }
}
```

---

## 8. PUT `/api/bookings/:booking_id`

> **Actualizar / reagendar cita.**

### Request body

```json
{
  "fecha": "2026-05-16",
  "hora": "14:00",
  "notas": "Reagendado a pedido del cliente"
}
```

> Reglas: solo se permite cambiar `fecha`, `hora`, `notas`, `status` y `comercial_id` (este último por admin).

### Comportamiento

- Si cambian `fecha` o `hora`: crea **nuevo booking** con `rescheduled_from` apuntando al actual y marca el actual como `rescheduled`.
- Re-sincroniza Google Calendar.
- Envía email de actualización.

### Response 200

```json
{
  "success": true,
  "data": {
    "old_booking_id": "EFFI-2026-001234",
    "new_booking_id": "EFFI-2026-001245",
    "fecha": "2026-05-16",
    "hora": "14:00",
    "status": "confirmed"
  }
}
```

---

## 9. DELETE `/api/bookings/:booking_id`

> **Cancelar cita.**

### Request body (opcional)

```json
{
  "reason": "Cliente no podrá asistir",
  "cancelled_by": "comercial:laura@effidiagnosticos.com"
}
```

### Comportamiento

- Marca `status = cancelled`.
- Borra evento de Google Calendar (async).
- Envía email de cancelación.
- **No borra la fila** (soft delete vía status).

### Response 200

```json
{
  "success": true,
  "data": {
    "booking_id": "EFFI-2026-001234",
    "status": "cancelled",
    "cancelled_at": "2026-05-11T16:00:00.000Z"
  }
}
```

---

## 10. GET `/api/health`

> **Health check para monitoreo.**

### Response 200

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime_seconds": 123456,
    "version": "1.0.0",
    "dependencies": {
      "supabase": "ok",
      "google_calendar": "ok",
      "gmail": "ok"
    }
  }
}
```

### Response 503

```json
{
  "success": false,
  "data": {
    "status": "degraded",
    "dependencies": {
      "supabase": "ok",
      "google_calendar": "down",
      "gmail": "ok"
    }
  }
}
```

---

## 📚 Documentos relacionados

- [`ARQUITECTURA_GENERAL.md`](./ARQUITECTURA_GENERAL.md)
- [`SCHEMA_SUPABASE.md`](./SCHEMA_SUPABASE.md)
- [`FLUJOS_LOGICA.md`](./FLUJOS_LOGICA.md) — Implementación detallada
- [`INTEGRACIONES_EXTERNAS.md`](./INTEGRACIONES_EXTERNAS.md)
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md)

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
