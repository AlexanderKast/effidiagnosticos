# 🔄 Migración desde N8N

> **Plan paso a paso para migrar del sistema N8N + Google Calendar al nuevo stack Claude + Supabase, sin perder citas.**

---

## 📑 Tabla de Contenidos

1. [Objetivo](#1-objetivo)
2. [Estado inicial](#2-estado-inicial)
3. [Estado final](#3-estado-final)
4. [Estrategia general](#4-estrategia-general)
5. [Fase 1: Setup paralelo](#5-fase-1-setup-paralelo)
6. [Fase 2: Migración de datos](#6-fase-2-migración-de-datos)
7. [Fase 3: Switch de tráfico](#7-fase-3-switch-de-tráfico)
8. [Fase 4: Monitoreo intensivo](#8-fase-4-monitoreo-intensivo)
9. [Plan de rollback](#9-plan-de-rollback)
10. [Comunicación interna](#10-comunicación-interna)
11. [Checklist final](#11-checklist-final)

---

## 1. Objetivo

Reemplazar el sistema actual basado en N8N + Google Calendar + Google Sheets por la nueva arquitectura **Claude + Supabase** sin:
- Perder ninguna cita existente
- Interrumpir el flujo de leads
- Dejar al equipo comercial ciego

**Métrica de éxito:**
- 0 citas perdidas durante la migración
- < 10 minutos de downtime planificado
- 100% de citas históricas migradas a Supabase

---

## 2. Estado inicial

| Componente | Tecnología | Estado |
|------------|------------|--------|
| Form de landing | HTML + JS | ✅ Funciona |
| Webhook receptor | N8N workflow `wf-booking-v3` | ⚠️ Cae cada ~8 días |
| Validación de disponibilidad | N8N + Google Calendar API | ⚠️ Acoplado |
| BD de citas | Google Sheets (`Citas_2026`) | ⚠️ No escala |
| Calendar destino | Google Calendar de `comercial@...` | ✅ Funciona |
| Emails | Gmail desde N8N | ⚠️ Falla con token |
| WhatsApp | N8N → WhatsApp Cloud API | ⚠️ Falla con token |

---

## 3. Estado final

| Componente | Tecnología |
|------------|------------|
| Form de landing | (sin cambios) |
| Webhook receptor | API `/api/confirm-booking` en Vercel |
| Validación | Lógica TypeScript + Supabase |
| BD de citas | **Supabase Postgres** (source of truth) |
| Calendar destino | Google Calendar (sync async) |
| Emails | Nodemailer + Gmail SMTP |
| WhatsApp | API directa a WhatsApp Cloud |

---

## 4. Estrategia general

**Aproximación: "Strangler Fig Pattern".**

Operamos **ambos sistemas en paralelo** durante una ventana de prueba. Solo cuando el nuevo demuestra ser estable, cambiamos el tráfico.

```
Día 1-3:    [N8N produce] +  [Supabase shadow lee y duplica]
Día 4:      [Switch 10% tráfico] → Supabase primario
Día 5-7:    [50% tráfico] Supabase
Día 8:      [100% tráfico] Supabase
Día 9+:     N8N apagado, en modo "rollback ready"
Día 30:     N8N retirado definitivamente
```

---

## 5. Fase 1: Setup paralelo

> **Duración estimada: 2 días. Sin impacto en producción.**

### 5.1 Crear infraestructura nueva

- [ ] Crear proyecto Supabase nuevo (`effi-agendamiento-prod`)
- [ ] Ejecutar `001_schema.sql` (ver [`SCHEMA_SUPABASE.md`](./SCHEMA_SUPABASE.md))
- [ ] Sembrar `comerciales` con el equipo actual
- [ ] Sembrar `holidays` Colombia 2026
- [ ] Crear proyecto Vercel
- [ ] Configurar env vars (ver [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md))
- [ ] Deploy a `api-staging.effidiagnosticos.com`

### 5.2 Validar el sistema nuevo

- [ ] Smoke test contra staging
- [ ] Test de carga moderada (50 req/min)
- [ ] Test de integración con Google Calendar (cuenta de prueba)
- [ ] Test de envío de email
- [ ] Test de WhatsApp (con número interno)

### 5.3 Configurar shadow logging

Modificar N8N para que **además** de su flujo normal, dispare un webhook al nuevo sistema:

```javascript
// N8N — paso adicional al final del workflow actual
const payload = {
  shadow: true,
  source: 'n8n-shadow',
  ...itemData
}

fetch('https://api-staging.effidiagnosticos.com/api/internal/shadow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Shadow-Key': $env.SHADOW_KEY },
  body: JSON.stringify(payload)
})
```

El endpoint `/api/internal/shadow` registra la cita en Supabase con flag `origen='shadow_n8n'` para validar que coincide con N8N.

### 5.4 Validar paridad

Después de 48h con shadow logging, comparar:

```sql
-- Citas en Supabase con origen shadow
SELECT COUNT(*) FROM bookings WHERE origen = 'shadow_n8n';
```

vs

```
Citas en Google Sheets en el mismo periodo
```

Deben ser idénticas (mismo número, mismos emails, mismas fechas).

---

## 6. Fase 2: Migración de datos

> **Duración estimada: 1 día. Sin impacto en producción.**

### 6.1 Exportar Google Sheets

```
File → Download → CSV
```

Guardar como `citas_historicas_2026.csv`.

### 6.2 Limpiar y normalizar

Script Python (`scripts/clean_csv.py`):

```python
import pandas as pd
from datetime import datetime

df = pd.read_csv('citas_historicas_2026.csv')

# Normalizar columnas
df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]

# Tipos
df['fecha'] = pd.to_datetime(df['fecha']).dt.strftime('%Y-%m-%d')
df['hora']  = df['hora'].str.zfill(5)   # '9:00' → '09:00'
df['email'] = df['email'].str.lower().str.strip()
df['whatsapp'] = df['whatsapp'].str.replace(r'[^\d+]', '', regex=True)

# Drop duplicados
df = df.drop_duplicates(subset=['email','fecha','hora'])

# Default status
df['status'] = df['status'].fillna('confirmed')

# Mapear comercial por email
comerciales = {
    'comercial1@effi.com': 'uuid-c1',
    'comercial2@effi.com': 'uuid-c2'
}
df['comercial_id'] = df['comercial_email'].map(comerciales)

# Generar booking_id legacy
df['booking_id'] = df.apply(lambda r: f"LEGACY-{r.name:06d}", axis=1)

df.to_csv('citas_limpias.csv', index=False)
print(f'OK: {len(df)} filas listas para importar')
```

### 6.3 Importar a Supabase

**Opción A: Supabase UI**
1. Dashboard → Table Editor → `bookings` → Import data → CSV
2. Mapear columnas
3. Importar

**Opción B: Script Node**
```typescript
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

const csv = readFileSync('citas_limpias.csv', 'utf-8')
const rows = parse(csv, { columns: true })

const CHUNK = 100
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK)
  const { error } = await supabase.from('bookings').upsert(slice, { onConflict: 'booking_id' })
  if (error) { console.error('Error:', error); break }
  console.log(`Importadas ${i + slice.length}/${rows.length}`)
}
```

### 6.4 Validar integridad

```sql
-- Total importado
SELECT COUNT(*) FROM bookings WHERE booking_id LIKE 'LEGACY-%';

-- Por comercial
SELECT c.nombre, COUNT(b.*) AS citas
FROM comerciales c
LEFT JOIN bookings b ON b.comercial_id = c.id
GROUP BY c.id, c.nombre;

-- Citas futuras (que requieren sync a Google)
SELECT COUNT(*) FROM bookings
WHERE fecha >= CURRENT_DATE AND status IN ('confirmed','pending');
```

### 6.5 Re-sincronizar citas futuras a Google

```sql
-- Generar calendar_events para citas futuras importadas
INSERT INTO calendar_events (booking_id, google_calendar_id, sync_status, payload)
SELECT
  b.id,
  COALESCE(c.google_calendar_id, 'primary'),
  'pending',
  jsonb_build_object(
    'summary', 'Cita Effi — ' || b.nombre,
    'start',   jsonb_build_object('dateTime', b.fecha || 'T' || b.hora || ':00-05:00'),
    'end',     jsonb_build_object('dateTime', b.fecha || 'T' || (b.hora::time + (b.duracion_min || ' min')::interval) || '-05:00')
  )
FROM bookings b
JOIN comerciales c ON c.id = b.comercial_id
WHERE b.booking_id LIKE 'LEGACY-%'
  AND b.fecha >= CURRENT_DATE
  AND b.status IN ('confirmed', 'pending');
```

Dispara el worker para procesar:
```bash
curl https://api-staging.effidiagnosticos.com/api/jobs/retry-sync
```

> Esto va a crear duplicados en Google Calendar (porque N8N ya creó eventos). Para evitar: marcar `sync_status='skipped'` en las citas ya sincronizadas previamente por N8N.

---

## 7. Fase 3: Switch de tráfico

> **Duración: ~10 minutos de cambio + 7 días de observación.**

### 7.1 Día D — Switch del landing

**Antes:**
```html
<form action="https://n8n.dev.kreoon.com/webhook/booking-v3" method="POST">
```

**Después:**
```html
<form id="booking-form">
  <!-- ... -->
</form>

<script>
  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = new FormData(e.target)
    const res = await fetch('https://api.effidiagnosticos.com/api/confirm-booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID()
      },
      body: JSON.stringify(Object.fromEntries(form))
    })
    const data = await res.json()
    if (data.success) {
      window.location.href = `/confirmacion?id=${data.data.booking_id}`
    } else {
      alert(data.error.message)
    }
  })
</script>
```

### 7.2 Switch gradual con feature flag

Si el landing tiene tráfico alto, usar flag para liberar gradualmente:

```javascript
const USE_NEW_API = Math.random() < 0.1   // 10% al nuevo
const endpoint = USE_NEW_API
  ? 'https://api.effidiagnosticos.com/api/confirm-booking'
  : 'https://n8n.dev.kreoon.com/webhook/booking-v3'
```

**Plan:**
- Día 1: 10%
- Día 2: 25%
- Día 3: 50%
- Día 4: 80%
- Día 5: 100%

### 7.3 Mantener N8N corriendo en modo "espejo"

N8N sigue activo pero solo escribe en su Google Sheets de respaldo (no envía emails ni WhatsApp). Esto sirve para validación cruzada.

---

## 8. Fase 4: Monitoreo intensivo

> **Primera semana: revisar a diario.**

### 8.1 Métricas a vigilar

| Métrica | Umbral OK | Umbral alerta |
|---------|-----------|---------------|
| Citas/día | similar a histórico | -20% o peor |
| Tasa de errores | < 0.5% | > 2% |
| Latencia p95 | < 800ms | > 1.5s |
| `calendar_events.failed` | < 5 | > 20 |
| Emails entregados | > 98% | < 90% |
| WhatsApp entregados | > 95% | < 80% |

### 8.2 Daily check (primera semana)

```sql
-- Citas creadas ayer
SELECT COUNT(*), origen
FROM bookings
WHERE created_at >= CURRENT_DATE - 1 AND created_at < CURRENT_DATE
GROUP BY origen;

-- Errores ayer
SELECT
  COUNT(*) AS errores,
  metadata->>'service' AS servicio
FROM audit_log
WHERE action = 'error'
  AND created_at >= CURRENT_DATE - 1 AND created_at < CURRENT_DATE
GROUP BY metadata->>'service';

-- Slots ocupados próxima semana (sanity check)
SELECT fecha, COUNT(*) AS citas
FROM bookings
WHERE fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
GROUP BY fecha
ORDER BY fecha;
```

### 8.3 Reunión diaria de 10 min

Durante la primera semana, reunión rápida con:
- Ingeniero a cargo
- Comercial líder
- Responsable de soporte

Agenda:
1. ¿Cuántas citas se crearon ayer?
2. ¿Algún cliente reportó problema?
3. ¿Algún error nuevo en logs?
4. ¿Acción correctiva si aplica?

---

## 9. Plan de rollback

Si en cualquier momento la nueva API falla gravemente:

### Rollback rápido (< 5 min)

**Paso 1 — Revertir landing:**
Cambiar el endpoint del form de vuelta a N8N:
```javascript
const endpoint = 'https://n8n.dev.kreoon.com/webhook/booking-v3'
```
Deploy del landing (Vercel auto-deploy).

**Paso 2 — Re-habilitar emails/WhatsApp en N8N:**
N8N estaba en modo "espejo solo Sheets". Re-activar nodos de email y WhatsApp.

**Paso 3 — Comunicar:**
- Notificar al equipo
- Si hay citas creadas en Supabase durante el incidente: exportar y crear manualmente en N8N/Sheets

### Rollback completo (datos)

Si necesitamos volver a Google Sheets como source of truth:

```sql
-- Exportar bookings de Supabase a CSV
COPY (
  SELECT booking_id, nombre, email, whatsapp, empresa, fecha, hora, status, created_at
  FROM bookings
  WHERE created_at >= '2026-05-11'   -- fecha del switch
) TO STDOUT WITH CSV HEADER;
```

Importar a Google Sheets manualmente.

---

## 10. Comunicación interna

### Antes del switch (1 semana antes)

Email al equipo comercial:

```
Asunto: 🔧 Migración del sistema de citas — info importante

Hola equipo,

La próxima semana migramos el sistema de agendamiento.

¿Qué cambia para ustedes?
- ✅ NADA en el día a día. Las citas seguirán llegando a su Google Calendar.
- ✅ Mismo email de confirmación.
- ✅ Mismo WhatsApp.

¿Qué mejora?
- ✅ Ya no habrá caídas de 8 días.
- ✅ Backup automático en BD.
- ✅ Dashboard nuevo (compartiremos pronto).

¿Qué hacer si algo falla?
- 📞 Escribir a [tech-lead]
- 📋 Reportar en canal #soporte-tech

Gracias por la paciencia,
Equipo Tecnología
```

### Durante el switch

- Pin en canal interno: "🚧 Migración en progreso — reportar cualquier cosa rara"
- Equipo de tech disponible vía Slack/WhatsApp por 3 días

### Post-migración (día 8)

- Email de cierre: "Migración completada ✅"
- Mostrar métricas: uptime, citas creadas, ahorro de costo
- Pedir feedback

---

## 11. Checklist final

### Pre-migración
- [ ] Schema desplegado en Supabase prod
- [ ] Comerciales sembrados
- [ ] Holidays sembrados
- [ ] API deployada en Vercel
- [ ] Domain `api.effidiagnosticos.com` apunta a Vercel
- [ ] Env vars verificadas
- [ ] Smoke tests pasando
- [ ] Shadow logging activo 48h+
- [ ] Paridad N8N ↔ Supabase confirmada
- [ ] Datos históricos importados
- [ ] Plan de rollback documentado y testeado
- [ ] Equipo comunicado

### Día del switch
- [ ] Backup de Google Sheets actual
- [ ] Snapshot de Supabase
- [ ] Cambio de endpoint en landing
- [ ] Deploy de landing
- [ ] Primer test real (yo mismo agendo una cita)
- [ ] Confirmar: BD ✅ Google Calendar ✅ Email ✅ WhatsApp ✅
- [ ] Monitorear primera hora

### Post-migración (primera semana)
- [ ] Daily check de métricas
- [ ] Daily standup 10 min
- [ ] Resolver issues inmediatamente
- [ ] Día 7: N8N a "modo apagado, listo para rollback"
- [ ] Día 30: N8N retirado definitivamente
- [ ] Post-mortem positivo: ¿qué aprendimos?

---

## 📚 Documentos relacionados

- [`ARQUITECTURA_GENERAL.md`](./ARQUITECTURA_GENERAL.md)
- [`SCHEMA_SUPABASE.md`](./SCHEMA_SUPABASE.md)
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
