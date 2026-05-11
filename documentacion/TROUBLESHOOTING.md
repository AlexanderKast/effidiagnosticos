# 🚨 Troubleshooting

> **Problemas frecuentes, cómo diagnosticarlos y cómo resolverlos.**

---

## 📑 Tabla de Contenidos

1. [Cómo leer logs](#1-cómo-leer-logs)
2. [Problema: Citas no se crean](#2-problema-citas-no-se-crean)
3. [Problema: Google Calendar no sincroniza](#3-problema-google-calendar-no-sincroniza)
4. [Problema: Emails no llegan](#4-problema-emails-no-llegan)
5. [Problema: WhatsApp no envía](#5-problema-whatsapp-no-envía)
6. [Problema: Latencia alta](#6-problema-latencia-alta)
7. [Problema: Doble booking en el mismo slot](#7-problema-doble-booking-en-el-mismo-slot)
8. [Problema: API devuelve 500 sin causa visible](#8-problema-api-devuelve-500-sin-causa-visible)
9. [Problema: Refresh token de Google expirado](#9-problema-refresh-token-de-google-expirado)
10. [Cómo ver el audit_log](#10-cómo-ver-el-audit_log)
11. [Alertas importantes](#11-alertas-importantes)
12. [Runbook de incidentes](#12-runbook-de-incidentes)

---

## 1. Cómo leer logs

### Vercel
```bash
vercel logs --follow
vercel logs <deployment-url> --since 1h
```

### VPS (PM2)
```bash
pm2 logs effi-api --lines 200
pm2 logs effi-api --err
pm2 monit                       # vista interactiva
```

### Supabase
- Dashboard → Logs → Postgres logs / API logs / Edge functions
- Filtrar por `severity = ERROR`

### Formato de log esperado

```json
{
  "level": "info",
  "timestamp": "2026-05-11T15:30:00.000Z",
  "request_id": "req_a1b2c3d4",
  "service": "effi-api",
  "msg": "booking.created",
  "booking_id": "EFFI-2026-001234",
  "comercial_id": "uuid",
  "duration_ms": 234
}
```

> Si un log no tiene `request_id`, es un bug — todo log debe poder trazarse a un request.

---

## 2. Problema: Citas no se crean

### Síntomas
- Formulario muestra error genérico
- Cliente reporta "no recibí confirmación"
- `bookings` no tiene la fila esperada

### Diagnóstico paso a paso

**Paso 1 — ¿Llegó el request?**
```bash
vercel logs --since 1h | grep "confirm-booking"
```
- ✅ Si aparece → seguir al paso 2
- ❌ Si NO aparece → revisa landing/CORS

**Paso 2 — ¿Qué error devolvió?**
Busca el `request_id` del fallo y mira la cadena completa:
```bash
vercel logs | grep "req_a1b2c3d4"
```

**Paso 3 — Códigos comunes**

| Code | Significado | Solución |
|------|-------------|----------|
| `INVALID_INPUT` | Body mal formado | Revisa Zod schema y form del landing |
| `INVALID_DATE` | Fecha festivo/pasado | Validar UX del datepicker |
| `SLOT_TAKEN` | Race condition | Esperado, ver paso 7 |
| `NO_COMERCIAL_AVAILABLE` | Sin equipo activo | Revisa `comerciales.activo` |
| `INTERNAL_ERROR` | Bug, ver stack | Ver paso 8 |

**Paso 4 — ¿Supabase está OK?**
```bash
curl https://api.effidiagnosticos.com/api/health
```

Si `dependencies.supabase = "down"`: revisar credenciales y status page.

### Solución rápida

```sql
-- Verifica que haya comerciales activos
SELECT COUNT(*) FROM comerciales WHERE activo = TRUE;
-- Si es 0 → activar al menos 1

UPDATE comerciales SET activo = TRUE WHERE email = 'comercial1@effidiagnosticos.com';
```

---

## 3. Problema: Google Calendar no sincroniza

### Síntomas
- Cita aparece en Supabase, no en Google Calendar
- Comercial no ve el evento
- `calendar_events.sync_status = 'failed'`

### Diagnóstico

**Paso 1 — Ver estado de sync:**
```sql
SELECT ce.booking_id, ce.sync_status, ce.sync_attempts, ce.last_error, ce.last_sync_at, b.fecha, b.hora
FROM calendar_events ce
JOIN bookings b ON b.id = ce.booking_id
WHERE ce.sync_status IN ('pending', 'failed')
ORDER BY ce.updated_at DESC
LIMIT 20;
```

**Paso 2 — Mirar `last_error`:**

| Error | Causa | Solución |
|-------|-------|----------|
| `401 unauthorized` | Refresh token revocado | Ver sección 9 |
| `403 Daily Limit Exceeded` | Cuota agotada | Esperar 24h o pedir aumento |
| `404 calendarId not found` | Calendar ID inválido | Verificar `comerciales.google_calendar_id` |
| `400 Invalid time range` | Payload mal formado | Revisar `buildGoogleEventPayload` |
| Timeout | Red lenta | Esperar reintento automático |

**Paso 3 — Forzar resync manual:**
```sql
UPDATE calendar_events
SET sync_status = 'pending', sync_attempts = 0
WHERE booking_id IN (
  SELECT id FROM bookings WHERE booking_id IN ('EFFI-2026-001234', 'EFFI-2026-001235')
);
```

Luego dispara el worker:
```bash
curl https://api.effidiagnosticos.com/api/jobs/retry-sync
```

### Test rápido de credenciales

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=$GOOGLE_CLIENT_ID" \
  -d "client_secret=$GOOGLE_CLIENT_SECRET" \
  -d "refresh_token=$GOOGLE_REFRESH_TOKEN" \
  -d "grant_type=refresh_token"
```

- ✅ Si devuelve `access_token` → credenciales OK
- ❌ Si devuelve `invalid_grant` → token revocado, ver sección 9

---

## 4. Problema: Emails no llegan

### Síntomas
- Cliente dice "no me llegó nada"
- Cita aparece en BD
- Cita aparece en Google Calendar

### Diagnóstico

**Paso 1 — Verificar conexión SMTP:**
```bash
node -e "
const nm = require('nodemailer');
const t = nm.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
});
t.verify().then(() => console.log('OK')).catch(console.error);
"
```

**Paso 2 — ¿Está en spam?**
- Pedir al cliente que revise spam
- Si está marcado: configurar SPF/DKIM/DMARC del dominio

**Paso 3 — Ver email_queue:**
```sql
SELECT booking_id, type, attempts, last_error, created_at
FROM email_queue
WHERE attempts > 0
ORDER BY created_at DESC
LIMIT 20;
```

| Error | Causa | Solución |
|-------|-------|----------|
| `EAUTH` | App password incorrecta | Regenerar app password en Google |
| `EENVELOPE` | Email destino inválido | Validar en frontend |
| `ECONNECTION` | Red bloqueada | Verificar firewall |
| `Daily limit exceeded` | Volumen alto | Migrar a SES o SendGrid |

**Paso 4 — Reenviar manualmente:**
```bash
curl -X POST https://api.effidiagnosticos.com/api/admin/resend-email \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"booking_id":"EFFI-2026-001234","type":"confirmation"}'
```

---

## 5. Problema: WhatsApp no envía

### Síntomas
- Email llega, WhatsApp no
- Cliente reporta "no recibí WhatsApp"

### Diagnóstico

**Paso 1 — Logs de Meta:**
```sql
SELECT created_at, metadata->>'error' AS err
FROM audit_log
WHERE action = 'error'
  AND metadata->>'service' = 'whatsapp'
ORDER BY created_at DESC
LIMIT 20;
```

**Paso 2 — Códigos comunes Meta:**

| Code | Significado | Solución |
|------|-------------|----------|
| 130472 | User bloqueó al business | Saltar, no reintentar |
| 131026 | Fuera de ventana 24h | Usar plantilla aprobada |
| 131047 | Reset ventana | Esperar al cliente que responda |
| 190 | Token inválido | Renovar token en Meta Business |
| 80007 | Rate limit | Backoff |
| 1006 | Número mal formado | Validar E.164 |

**Paso 3 — Probar token:**
```bash
curl "https://graph.facebook.com/v18.0/me?access_token=$WHATSAPP_TOKEN"
```

Si devuelve error → renovar token.

---

## 6. Problema: Latencia alta

### Síntomas
- Página de confirmación tarda > 3s
- Vercel Analytics muestra p95 > 1s

### Diagnóstico

**Paso 1 — Identificar endpoint lento:**
Vercel Analytics → ordenar por `p95 desc`.

**Paso 2 — Ver queries lentas en Supabase:**
- Dashboard → Database → Query Performance
- Ordenar por `mean_time` descendente

**Paso 3 — Causas comunes:**

| Causa | Solución |
|-------|----------|
| Falta índice en `bookings` | `CREATE INDEX idx_bookings_fecha ON bookings(fecha)` |
| N+1 queries en `selectComercial` | Hacer un solo query con JOIN |
| Llamada síncrona a Google | Mover a async (fire-and-forget) |
| Cold start de Vercel | Activar Vercel Pro o KEEP-ALIVE |
| Plan free de Supabase | Upgrade a Pro |

**Paso 4 — Profilear con `EXPLAIN ANALYZE`:**

```sql
EXPLAIN ANALYZE
SELECT * FROM bookings
WHERE fecha = '2026-05-15' AND status IN ('confirmed','pending');
```

Si hay `Seq Scan` en lugar de `Index Scan` → falta índice.

---

## 7. Problema: Doble booking en el mismo slot

### Causa raíz

Race condition entre validar disponibilidad y crear el booking. Dos clientes piden el mismo slot en milisegundos.

### Cómo se previene

1. **Constraint UNIQUE en BD:**

```sql
ALTER TABLE bookings
ADD CONSTRAINT uniq_comercial_fecha_hora_activo
EXCLUDE USING gist (
  comercial_id WITH =,
  fecha WITH =,
  hora WITH =
) WHERE (status IN ('confirmed', 'pending'));
```

> Requiere extensión `btree_gist`. Garantiza que un comercial no puede tener 2 citas activas en mismo slot.

2. **Idempotency-Key en el endpoint:** doble click del usuario no duplica.

3. **Re-check antes de insertar:** `isSlotTaken()` justo antes del INSERT.

### Si ya ocurrió: limpiar

```sql
-- Encontrar duplicados
SELECT fecha, hora, comercial_id, COUNT(*)
FROM bookings
WHERE status IN ('confirmed','pending')
GROUP BY fecha, hora, comercial_id
HAVING COUNT(*) > 1;

-- Mantener la más vieja, cancelar las demás
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY fecha, hora, comercial_id
    ORDER BY created_at
  ) AS rn
  FROM bookings
  WHERE status IN ('confirmed','pending')
)
UPDATE bookings SET
  status = 'cancelled',
  cancel_reason = 'duplicado detectado en limpieza'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

---

## 8. Problema: API devuelve 500 sin causa visible

### Diagnóstico

**Paso 1 — Stack trace:**
```bash
vercel logs --since 1h | grep -A 20 "ERROR"
```

**Paso 2 — Causas habituales:**

| Stack contiene | Causa |
|----------------|-------|
| `JSON.parse` | Body inválido, validar Content-Type |
| `null is not an object` | Falta verificación de null |
| `ECONNREFUSED` | Supabase down |
| `Maximum call stack` | Recursión infinita |
| `Unhandled promise` | Falta try/catch |

**Paso 3 — Habilitar logs detallados:**

Setear `LOG_LEVEL=debug` temporalmente y reproducir.

**Paso 4 — Sentry (recomendado):**

Configurar Sentry para captura automática:
```bash
npm install @sentry/node
```

```typescript
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.2,
  environment: process.env.NODE_ENV
})
```

---

## 9. Problema: Refresh token de Google expirado

### Síntoma
Logs muestran:
```
{ "error": "invalid_grant", "error_description": "Token has been expired or revoked." }
```

### Por qué pasa
- Usuario revocó acceso desde Google Account
- App marcada como "no usada" por meses
- Cambio de password en cuenta admin

### Solución

**Paso 1 — Regenerar refresh token:**
1. Ir a https://developers.google.com/oauthplayground
2. Engranaje → "Use your own OAuth credentials" → pegar `client_id` y `client_secret`
3. Seleccionar scope `https://www.googleapis.com/auth/calendar`
4. Authorize → login con cuenta dueña
5. Step 2 → Exchange authorization code for tokens
6. Copiar el nuevo `refresh_token`

**Paso 2 — Actualizar en Vercel/VPS:**
```bash
vercel env rm GOOGLE_REFRESH_TOKEN production
vercel env add GOOGLE_REFRESH_TOKEN production
# pegar el nuevo
vercel --prod
```

**Paso 3 — Resync eventos pendientes:**
```sql
UPDATE calendar_events
SET sync_status = 'pending', sync_attempts = 0
WHERE sync_status = 'failed' AND last_error LIKE '%invalid_grant%';
```

```bash
curl https://api.effidiagnosticos.com/api/jobs/retry-sync
```

**Paso 4 — Prevención:**
- Crear test programado que valide el token semanalmente
- Configurar alerta si retorna 401

---

## 10. Cómo ver el audit_log

### Queries útiles

**Últimas 20 acciones:**
```sql
SELECT created_at, actor, action, resource_type, resource_id
FROM audit_log
ORDER BY created_at DESC
LIMIT 20;
```

**Historia de una cita específica:**
```sql
SELECT created_at, action, payload_before, payload_after
FROM audit_log
WHERE resource_type = 'booking' AND resource_id = (
  SELECT id::TEXT FROM bookings WHERE booking_id = 'EFFI-2026-001234'
)
ORDER BY created_at;
```

**Errores últimas 24h:**
```sql
SELECT created_at, metadata->>'service' AS svc, metadata->>'error' AS err
FROM audit_log
WHERE action = 'error' AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Acciones por hora (gráfico):**
```sql
SELECT
  DATE_TRUNC('hour', created_at) AS hora,
  action,
  COUNT(*) AS total
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hora, action
ORDER BY hora DESC, action;
```

---

## 11. Alertas importantes

| Alerta | Severidad | Notificación |
|--------|-----------|--------------|
| Google `invalid_grant` | 🔴 Crítica | SMS + email + Slack |
| Health check fail 3x | 🔴 Crítica | SMS + email |
| Error rate > 5% por 5min | 🟠 Alta | Slack + email |
| `calendar_events.failed` > 20 | 🟠 Alta | Slack |
| Latencia p95 > 1.5s por 10min | 🟡 Media | Slack |
| Gmail rate limit | 🟡 Media | Slack |
| WhatsApp 80007 (rate limit) | 🟡 Media | Slack |
| BD > 80% conexiones | 🟠 Alta | Slack |
| Espacio en disco < 10% | 🟠 Alta | Slack |

Implementar con UptimeRobot + Grafana + Slack webhook.

---

## 12. Runbook de incidentes

### Si el sistema está caído

1. **Confirmar el incidente:**
   ```bash
   curl https://api.effidiagnosticos.com/api/health
   ```
2. **Verificar status pages externos:**
   - https://www.supabase-status.com
   - https://www.google-status.com
   - https://www.vercel-status.com
3. **Revisar deploys recientes:**
   ```bash
   vercel ls --limit 5
   ```
4. **Si fue un deploy malo → rollback:**
   ```bash
   vercel promote <deployment-url-anterior>
   ```
5. **Comunicar:**
   - Pin en Slack interno
   - Email a equipo comercial
   - Banner en landing si dura > 30min
6. **Post-mortem en 48h:**
   - Causa raíz
   - Línea de tiempo
   - Acción correctiva
   - Documentar en `10 - Claude/Decisiones/` (Obsidian)

### Plantilla post-mortem

```markdown
# Incidente — YYYY-MM-DD — [Título]

## Resumen
- **Duración:** 15min
- **Impacto:** X citas no se crearon, Y emails no enviados
- **Severidad:** 🔴 Crítica

## Línea de tiempo
- HH:MM — Detectado por alerta de UptimeRobot
- HH:MM — Equipo notificado vía Slack
- HH:MM — Identificada causa raíz
- HH:MM — Fix deployado
- HH:MM — Sistema recuperado

## Causa raíz
[Descripción técnica]

## Resolución
[Qué se hizo]

## Acciones correctivas
- [ ] ...
- [ ] ...
- [ ] ...
```

---

## 📚 Documentos relacionados

- [`ARQUITECTURA_GENERAL.md`](./ARQUITECTURA_GENERAL.md)
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
- [`INTEGRACIONES_EXTERNAS.md`](./INTEGRACIONES_EXTERNAS.md)
- [`FLUJOS_LOGICA.md`](./FLUJOS_LOGICA.md)

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
