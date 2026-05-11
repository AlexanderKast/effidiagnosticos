# 🔗 Integraciones Externas

> **Google Calendar, Gmail SMTP, WhatsApp Cloud API.**

---

## 📑 Tabla de Contenidos

1. [Google Calendar API](#1-google-calendar-api)
2. [Gmail SMTP](#2-gmail-smtp)
3. [WhatsApp Cloud API](#3-whatsapp-cloud-api)
4. [Manejo de errores cross-integración](#4-manejo-de-errores-cross-integración)
5. [Costos estimados](#5-costos-estimados)

---

## 1. Google Calendar API

### 1.1 ¿Qué necesitas?

| Recurso | Dónde |
|---------|-------|
| Proyecto Google Cloud | `console.cloud.google.com` |
| Service Account o OAuth2 | API & Services → Credentials |
| API habilitada: Google Calendar API | API Library |
| `client_id`, `client_secret`, `refresh_token` | OAuth Playground |
| Calendario destino (`google_calendar_id`) | Calendar settings |

### 1.2 Setup paso a paso

**Paso 1 — Crear proyecto**
1. Ir a https://console.cloud.google.com
2. Crear proyecto: `effi-agendamiento`
3. Habilitar **Google Calendar API**

**Paso 2 — Crear OAuth2 credentials**
1. APIs & Services → Credentials → Create credentials → OAuth client ID
2. Tipo: **Web application**
3. Authorized redirect URIs: `https://developers.google.com/oauthplayground`
4. Descargar `client_id` y `client_secret`

**Paso 3 — Obtener refresh_token**
1. Ir a https://developers.google.com/oauthplayground
2. Click engranaje → marcar "Use your own OAuth credentials"
3. Pegar `client_id` y `client_secret`
4. Step 1: seleccionar scope `https://www.googleapis.com/auth/calendar`
5. "Authorize APIs" → loguearse con la cuenta dueña del calendario
6. Step 2: "Exchange authorization code for tokens"
7. Copiar `refresh_token` ← **este NO expira a menos que se revoque**

**Paso 4 — Guardar credenciales**
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REFRESH_TOKEN=1//04xxx
GCAL_DEFAULT=primary
```

### 1.3 Cliente en código

```typescript
import { google } from 'googleapis'

const oauth2 = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
)

oauth2.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN
})

export const calendar = google.calendar({ version: 'v3', auth: oauth2 })
```

### 1.4 Crear evento (request exacto)

```typescript
const response = await calendar.events.insert({
  calendarId: 'primary',
  conferenceDataVersion: 1,
  sendUpdates: 'all',
  requestBody: {
    summary: 'Cita Effi — Juan Pérez (Acme)',
    description: '...',
    start: { dateTime: '2026-05-15T10:30:00-05:00', timeZone: 'America/Bogota' },
    end:   { dateTime: '2026-05-15T11:00:00-05:00', timeZone: 'America/Bogota' },
    attendees: [
      { email: 'laura@effidiagnosticos.com', responseStatus: 'accepted' },
      { email: 'juan@empresa.com',          responseStatus: 'needsAction' }
    ],
    conferenceData: {
      createRequest: {
        requestId: 'EFFI-2026-001234',
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 1440 },
        { method: 'popup', minutes: 15 }
      ]
    }
  }
})

// response.data.id              → ID del evento (guardar en calendar_events)
// response.data.hangoutLink     → link de Google Meet
// response.data.htmlLink        → link al evento en Calendar UI
```

### 1.5 Actualizar evento

```typescript
await calendar.events.patch({
  calendarId: 'primary',
  eventId: googleEventId,
  sendUpdates: 'all',
  requestBody: {
    start: { dateTime: nuevaFechaHora, timeZone: 'America/Bogota' },
    end:   { dateTime: nuevoFin,       timeZone: 'America/Bogota' }
  }
})
```

### 1.6 Eliminar evento

```typescript
await calendar.events.delete({
  calendarId: 'primary',
  eventId: googleEventId,
  sendUpdates: 'all'
})
```

### 1.7 Manejo de errores

| HTTP | Significado | Acción |
|------|-------------|--------|
| 400 | Bad request (payload inválido) | Loggear, **NO reintentar** |
| 401 | Refresh token revocado | Alertar admin urgente, reauth |
| 403 | Cuota excedida | Backoff exponencial |
| 404 | Evento no existe | Marcar `sync_status = synced` y seguir |
| 409 | Conflicto / duplicado | Loggear, considerar synced |
| 410 | Recurso eliminado | Marcar synced |
| 5xx | Server error de Google | Reintentar con backoff |

```typescript
try {
  await calendar.events.insert({ ... })
} catch (err) {
  if (err.code === 401) {
    await alertAdmin('Google refresh token revoked!')
    throw err
  }
  if (err.code === 403 && err.message.includes('quota')) {
    await sleep(60_000)
    throw err   // que el worker reintente después
  }
  if (err.code >= 500) {
    throw err   // que el worker reintente
  }
  // 4xx que no son 401/403: error de payload, no reintentar
  await markSyncFailed(bookingId, err.message, { permanent: true })
}
```

### 1.8 Sincronización (si falla)

Ya documentado en [FLUJOS_LOGICA.md → Flujo 6](./FLUJOS_LOGICA.md#7-flujo-6-worker-de-reintentos).

Resumen:
- Cron cada 5 min lee `calendar_events WHERE sync_status IN ('pending','failed') AND sync_attempts < 5`
- Backoff exponencial: 30s, 2m, 10m, 1h
- Tras 5 fallos: alerta y se deja de reintentar
- Admin puede forzar resync manualmente

---

## 2. Gmail SMTP

### 2.1 Configuración

**Requisitos:**
- Cuenta Gmail (preferiblemente Google Workspace)
- Verificación en 2 pasos activada
- **App Password** generada (no la contraseña normal)

**Generar App Password:**
1. Cuenta Google → Seguridad → Verificación en 2 pasos
2. Abajo: "Contraseñas de aplicación"
3. Generar para "Correo" → "Otro" → "Effi Backend"
4. Copiar los 16 caracteres

**Variables de entorno:**
```env
GMAIL_USER=notificaciones@effidiagnosticos.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
```

### 2.2 Cliente Nodemailer

```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
})

// Verificar conexión al boot
transporter.verify().then(() => {
  console.log('Gmail SMTP listo')
}).catch(err => {
  console.error('Gmail SMTP error:', err.message)
})
```

### 2.3 Template de email de confirmación

```typescript
function buildConfirmationEmail(booking, comercial) {
  return {
    from: `Effi Diagnósticos <${process.env.GMAIL_USER}>`,
    to: booking.email,
    cc: comercial.email,
    subject: `✅ Cita confirmada — ${formatFecha(booking.fecha)} ${booking.hora}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cita confirmada</title>
</head>
<body style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto; padding:20px;">

  <div style="background:#0066cc; color:#fff; padding:20px; border-radius:8px 8px 0 0;">
    <h1 style="margin:0;">¡Tu cita está confirmada!</h1>
  </div>

  <div style="border:1px solid #e0e0e0; border-top:0; padding:20px; border-radius:0 0 8px 8px;">
    <p>Hola <strong>${booking.nombre}</strong>,</p>

    <p>Tu cita con el equipo de <strong>Effi Diagnósticos</strong> ha sido confirmada con los siguientes detalles:</p>

    <table style="width:100%; border-collapse:collapse; margin:20px 0;">
      <tr>
        <td style="padding:10px; background:#f5f5f5;"><strong>📅 Fecha</strong></td>
        <td style="padding:10px;">${formatFecha(booking.fecha)}</td>
      </tr>
      <tr>
        <td style="padding:10px; background:#f5f5f5;"><strong>🕐 Hora</strong></td>
        <td style="padding:10px;">${booking.hora} (hora Colombia)</td>
      </tr>
      <tr>
        <td style="padding:10px; background:#f5f5f5;"><strong>⏱️ Duración</strong></td>
        <td style="padding:10px;">${booking.duracion_min} minutos</td>
      </tr>
      <tr>
        <td style="padding:10px; background:#f5f5f5;"><strong>👤 Te atenderá</strong></td>
        <td style="padding:10px;">${comercial.nombre}</td>
      </tr>
      <tr>
        <td style="padding:10px; background:#f5f5f5;"><strong>🔗 Enlace Zoom</strong></td>
        <td style="padding:10px;"><a href="${booking.zoom_link}">${booking.zoom_link}</a></td>
      </tr>
      <tr>
        <td style="padding:10px; background:#f5f5f5;"><strong>🆔 ID Cita</strong></td>
        <td style="padding:10px;"><code>${booking.booking_id}</code></td>
      </tr>
    </table>

    <p style="background:#fff3cd; padding:15px; border-left:4px solid #ffc107; margin:20px 0;">
      <strong>💡 Tip:</strong> Agrega esta cita a tu calendario y conéctate 5 minutos antes para verificar tu cámara y micrófono.
    </p>

    <p>Si necesitas <strong>reagendar o cancelar</strong>, responde este correo o escríbenos por WhatsApp al <a href="https://wa.me/573001234567">+57 300 123 4567</a>.</p>

    <p>¡Nos vemos pronto!</p>

    <p style="color:#666; font-size:12px; margin-top:30px; border-top:1px solid #e0e0e0; padding-top:15px;">
      Effi Diagnósticos · Bogotá, Colombia<br>
      <a href="https://effidiagnosticos.com">effidiagnosticos.com</a>
    </p>
  </div>

</body>
</html>
    `,
    text: `
¡Cita confirmada!

Hola ${booking.nombre},

Tu cita con Effi Diagnósticos ha sido confirmada:

📅 Fecha: ${formatFecha(booking.fecha)}
🕐 Hora: ${booking.hora} (hora Colombia)
⏱️ Duración: ${booking.duracion_min} min
👤 Te atenderá: ${comercial.nombre}
🔗 Zoom: ${booking.zoom_link}
🆔 ID: ${booking.booking_id}

Para reagendar o cancelar, responde este correo o escríbenos al WhatsApp +57 300 123 4567.

¡Nos vemos pronto!
Equipo Effi Diagnósticos
    `.trim()
  }
}
```

### 2.4 Cuándo se envía el email

| Evento | Destinatario | Asunto |
|--------|--------------|--------|
| Confirmación de cita | Cliente + CC comercial | `✅ Cita confirmada — ...` |
| Recordatorio 24h antes | Cliente | `⏰ Recordatorio: tu cita es mañana` |
| Recordatorio 1h antes | Cliente | `🔔 Tu cita es en 1 hora` |
| Cancelación | Cliente + CC comercial | `❌ Cita cancelada — ...` |
| Reagendamiento | Cliente + CC comercial | `🔄 Cita reagendada — ...` |

Los recordatorios se manejan vía cron job adicional.

### 2.5 Manejo de errores

```typescript
try {
  await transporter.sendMail(mailOptions)
} catch (err) {
  logger.error('Gmail send failed', { bookingId, err: err.message })

  // Guardar en cola de reintento
  await supabase.from('email_queue').insert({
    booking_id: bookingId,
    type: 'confirmation',
    payload: mailOptions,
    attempts: 1,
    last_error: err.message
  })

  if (err.code === 'EAUTH') {
    await alertAdmin('Gmail auth failed — revisa app password', { err: err.message })
  }
}
```

| Error code | Causa | Acción |
|------------|-------|--------|
| `EAUTH` | App password inválida | Alertar admin |
| `ETIMEDOUT` | Red lenta | Reintentar |
| `ECONNREFUSED` | Gmail bloqueado | Reintentar + alertar |
| `EENVELOPE` | Email destino inválido | No reintentar |

---

## 3. WhatsApp Cloud API

### 3.1 Configuración (Meta)

**Requisitos:**
- Cuenta Meta Business Suite
- Número de teléfono verificado
- App de WhatsApp configurada
- **Token de acceso permanente** (no el temporal de 24h)

**Variables:**
```env
WHATSAPP_TOKEN=EAAxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321
```

### 3.2 Plantilla aprobada

Meta exige plantillas **pre-aprobadas** para mensajes salientes a usuarios que no iniciaron conversación.

**Plantilla `cita_confirmada` (aprobar en Business Manager):**

```
Hola {{1}}, tu cita con Effi Diagnósticos quedó confirmada para el {{2}} a las {{3}}.

🔗 Zoom: {{4}}
👤 Te atiende: {{5}}
🆔 {{6}}

Responde "REAGENDAR" si necesitas cambiar.
```

### 3.3 Enviar mensaje

```typescript
async function sendWhatsappConfirmation(booking, comercial) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

  const body = {
    messaging_product: 'whatsapp',
    to: cleanPhone(booking.whatsapp),
    type: 'template',
    template: {
      name: 'cita_confirmada',
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: booking.nombre },
            { type: 'text', text: formatFecha(booking.fecha) },
            { type: 'text', text: booking.hora },
            { type: 'text', text: booking.zoom_link },
            { type: 'text', text: comercial.nombre },
            { type: 'text', text: booking.booking_id }
          ]
        }
      ]
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`WhatsApp: ${JSON.stringify(error)}`)
  }

  return await response.json()
}

function cleanPhone(phone) {
  // Remueve +, espacios, paréntesis. Asegura formato E.164 sin +
  return phone.replace(/[^\d]/g, '')
}
```

### 3.4 Errores comunes

| Código Meta | Causa | Acción |
|-------------|-------|--------|
| 130472 | User está en bloqueo de mensajes | Saltar, no reintentar |
| 131026 | Mensaje fuera de ventana de 24h sin plantilla | Usar plantilla |
| 131047 | Reset de 24h ventana | Usar plantilla |
| 190 | Token inválido o expirado | Refrescar token, alertar |
| 80007 | Rate limit alcanzado | Backoff |

---

## 4. Manejo de errores cross-integración

### Filosofía

> **Una cita debe poder crearse aunque TODAS las integraciones externas fallen.**

```
                         ┌──────────────────┐
                         │ Cita en Supabase │
                         │  status: confirmed│
                         └────────┬─────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │ Google Sync  │  │ Gmail Send   │  │ WhatsApp Send│
        │ (async)      │  │ (async)      │  │ (async)      │
        └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
               │                 │                 │
               ▼                 ▼                 ▼
        Si falla → queue   Si falla → queue   Si falla → queue
        retry 5 veces      retry 5 veces      retry 3 veces
```

### Logs centralizados

```typescript
logger.info('integration.success', {
  service: 'google_calendar',
  bookingId,
  duration_ms: 234
})

logger.error('integration.failure', {
  service: 'google_calendar',
  bookingId,
  error: err.message,
  attempt: 2,
  willRetry: true
})
```

### Dashboard de salud

Vista en `audit_log` filtrada por `action = 'sync' AND status = 'failed'` agrupada por servicio para detectar caídas.

```sql
SELECT
  metadata->>'service' AS service,
  COUNT(*) FILTER (WHERE action = 'sync' AND metadata->>'status' = 'failed') AS failures,
  COUNT(*) FILTER (WHERE action = 'sync' AND metadata->>'status' = 'success') AS successes,
  MAX(created_at) AS last_failure_at
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY metadata->>'service';
```

---

## 5. Costos estimados

| Servicio | Plan | Costo mensual estimado |
|----------|------|------------------------|
| Google Calendar API | Free tier | $0 (hasta 1M req/día) |
| Gmail SMTP | Workspace | ya pagado (Workspace plan) |
| WhatsApp Cloud API | Conversational | ~$0.05 por conversación iniciada por business |
| Supabase | Pro (8GB BD) | $25/mes |
| Vercel | Hobby o Pro | $0 - $20/mes |
| **Total estimado** | | **$25-$50/mes** |

Volumen estimado: 500 citas/mes → costo WhatsApp ~$25/mes.

---

## 📚 Documentos relacionados

- [`ARQUITECTURA_GENERAL.md`](./ARQUITECTURA_GENERAL.md)
- [`FLUJOS_LOGICA.md`](./FLUJOS_LOGICA.md)
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
