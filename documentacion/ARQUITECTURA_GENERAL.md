# 🏗️ Arquitectura General — Sistema de Agendamiento

> **Reemplazo de N8N + Google Calendar por Claude + Supabase como source of truth.**

---

## 📑 Tabla de Contenidos

1. [Introducción](#1-introducción-por-qué-cambiar)
2. [Flujo Actual (N8N)](#2-flujo-actual-n8n)
3. [Problemas del Sistema Actual](#3-problemas-del-sistema-actual)
4. [Solución Propuesta](#4-solución-propuesta-claude--supabase)
5. [Stack Tecnológico](#5-stack-tecnológico)
6. [Diagrama de Despliegue](#6-diagrama-de-despliegue)
7. [Decisiones de Arquitectura](#7-decisiones-de-arquitectura)
8. [Consideraciones de Seguridad](#8-consideraciones-de-seguridad)
9. [Documentos Relacionados](#9-documentos-relacionados)

---

## 1. Introducción — ¿Por qué cambiar?

El sistema actual basado en **N8N + Google Calendar + Google Sheets** sufre caídas recurrentes cada **~8 días**. La causa raíz es la expiración del refresh token de Google OAuth, que requiere intervención manual para renovarse.

**Impacto del problema:**
- Pérdida de citas comerciales durante ventanas de caída
- Comerciales sin agenda actualizada
- Trabajo manual de reconciliación
- Mala experiencia para el prospecto (formulario falla)

**Objetivo del rediseño:**
Hacer que **Supabase sea el "source of truth"** y que Google Calendar pase a ser un sistema **opcional / asíncrono** para la visualización del equipo comercial. Si Google falla, las citas siguen creándose.

---

## 2. Flujo Actual (N8N)

```
┌─────────────┐       ┌──────────┐       ┌──────────────────┐
│   Landing   │──────▶│   N8N    │──────▶│ Google Calendar  │
│  (form web) │       │ Workflow │       │   (API REST)     │
└─────────────┘       └─────┬────┘       └──────────────────┘
                            │
                            ├──────────▶ Google Sheets (registro)
                            │
                            ├──────────▶ Gmail (notificación)
                            │
                            └──────────▶ WhatsApp (confirmación)
```

**Pasos del flujo:**

1. El visitante llena el formulario en la landing.
2. La landing dispara un **webhook a N8N**.
3. N8N **consulta Google Calendar** para validar disponibilidad.
4. N8N **crea el evento** en Google Calendar.
5. N8N **escribe la fila** en Google Sheets.
6. N8N **envía correo** vía Gmail.
7. N8N **dispara mensaje** por WhatsApp Cloud API.

**Punto único de falla:** todo depende de que el token de Google esté vigente.

---

## 3. Problemas del Sistema Actual

| # | Problema | Frecuencia | Impacto |
|---|----------|------------|---------|
| 1 | Refresh token de Google expira | Cada ~8 días | 🔴 Crítico |
| 2 | N8N pierde credenciales en redeploy | Esporádico | 🟠 Alto |
| 3 | Sin auditoría centralizada | Constante | 🟡 Medio |
| 4 | Google Sheets como BD (no escala) | Constante | 🟡 Medio |
| 5 | Sin reintentos automáticos | Esporádico | 🟠 Alto |
| 6 | No hay rollback si un paso falla | Esporádico | 🔴 Crítico |
| 7 | Difícil de debuggear | Constante | 🟡 Medio |

**Conclusión:** El sistema actual está fuertemente acoplado a Google y a N8N. Una falla en cualquiera tumba todo el flujo.

---

## 4. Solución Propuesta (Claude + Supabase)

```
┌─────────────┐
│   Landing   │
│  (form web) │
└──────┬──────┘
       │
       ▼ HTTPS POST
┌────────────────────────────────────┐
│       API Express / Vercel         │
│  ┌──────────────────────────────┐  │
│  │ POST /api/validate-availability│  │
│  │ POST /api/confirm-booking    │  │
│  └──────────────────────────────┘  │
└──────┬──────────────┬──────────────┘
       │              │
       ▼              ▼
┌──────────────┐  ┌──────────────────────┐
│   Supabase   │  │   Claude (Anthropic) │
│  (Postgres)  │  │   — opcional, para   │
│              │  │     validación NLP   │
│ • bookings   │  │     o priorización   │
│ • comerciales│  └──────────────────────┘
│ • slots      │
│ • calendar_  │
│   events     │
│ • audit_log  │
└──────┬───────┘
       │
       │ async (fire-and-forget)
       ▼
┌──────────────────────────────┐
│ Google Calendar API (opcional)│
│ Gmail SMTP                    │
│ WhatsApp Cloud API            │
└──────────────────────────────┘
```

**Principios clave:**

- ✅ **Supabase es la verdad absoluta.** Si una cita está en `bookings`, existe.
- ✅ **Google Calendar es un consumidor.** Se sincroniza después, no antes.
- ✅ **Si Google falla, la cita NO se pierde.** Queda marcada como `pending_sync`.
- ✅ **Cada acción se audita** en `audit_log`.
- ✅ **Reintentos automáticos** vía worker o cron.

---

## 5. Stack Tecnológico

| Capa | Tecnología | Razón |
|------|------------|-------|
| Frontend | Landing existente (HTML/JS) | No tocar lo que funciona |
| API | Node.js + Express + TypeScript | Familiar, rápido, deployable en Vercel |
| Base de datos | **Supabase (Postgres 15)** | Source of truth, RLS, realtime |
| Cache de slots | Redis (opcional) o tabla `slots_available` | Acelerar consultas de disponibilidad |
| Calendar | **Google Calendar API** (async) | Visualización del equipo |
| Email | **Nodemailer + Gmail SMTP** | Simple, ya configurado |
| WhatsApp | WhatsApp Cloud API | Confirmaciones |
| Hosting | **Vercel** (recomendado) o VPS | Serverless, deploy automático |
| Logs | Supabase `audit_log` + Vercel logs | Trazabilidad completa |
| Monitoreo | Vercel Analytics + Supabase metrics | Out of the box |

---

## 6. Diagrama de Despliegue

```
┌────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└──────────────────────────────┬─────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
       ┌────────────────┐           ┌────────────────────┐
       │   Cloudflare   │           │  WhatsApp Cloud    │
       │   (CDN/DNS)    │           │  (Meta API)        │
       └────────┬───────┘           └─────────┬──────────┘
                │                             │
                ▼                             │
       ┌────────────────┐                     │
       │  Vercel Edge   │                     │
       │   (Landing)    │                     │
       └────────┬───────┘                     │
                │                             │
                ▼                             │
       ┌─────────────────────────┐           │
       │  Vercel Serverless      │◀──────────┘
       │  /api/* (Node/Express)  │
       └────────┬────────────────┘
                │
        ┌───────┼────────────────────┐
        │       │                    │
        ▼       ▼                    ▼
  ┌──────────┐ ┌──────────────┐ ┌────────────────┐
  │ Supabase │ │ Google       │ │ Gmail SMTP     │
  │ Postgres │ │ Calendar API │ │ (Nodemailer)   │
  └──────────┘ └──────────────┘ └────────────────┘
```

---

## 7. Decisiones de Arquitectura

### Decisión 1: Supabase en lugar de Postgres self-hosted

**Contexto:** Necesitamos una BD relacional confiable, con backups y bajo overhead operativo.

**Opciones:**
- A) Supabase (managed Postgres)
- B) Postgres en VPS
- C) Firestore / DynamoDB

**Decisión:** ✅ **Supabase**

**Razones:**
- Backups automáticos
- Row Level Security incluida
- Cliente JS oficial
- Free tier suficiente para volumen actual
- Dashboard amigable para debugging

---

### Decisión 2: Sincronización asíncrona a Google Calendar

**Contexto:** Hoy si Google falla, la cita no se crea.

**Decisión:** ✅ **Hacer sync async (fire-and-forget) con reintentos**

**Razones:**
- Resiliencia: el cliente confirma su cita aunque Google esté caído
- Reintentos automáticos vía cron o worker
- Estado visible en `calendar_events.sync_status`

**Trade-off:** El comercial puede ver el evento con segundos/minutos de retraso. Aceptable.

---

### Decisión 3: Vercel sobre VPS

**Contexto:** Necesitamos un host confiable, escalable y barato.

**Opciones:**
- A) Vercel (serverless)
- B) VPS Hostinger (ya existente)
- C) AWS Lambda

**Decisión:** ✅ **Vercel** (con VPS como fallback documentado)

**Razones:**
- Deploy automático desde GitHub
- HTTPS y CDN automáticos
- Escala automáticamente
- Free tier amplio
- Sin gestión de servidor

---

### Decisión 4: Selección de comercial = round-robin

**Contexto:** Hay múltiples comerciales activos para una cita.

**Opciones:**
- A) Round-robin
- B) Random
- C) Carga ponderada (menos citas = más prioridad)

**Decisión:** ✅ **Round-robin** (con plan de pasar a carga ponderada después)

**Razones:**
- Justo y predecible
- Fácil de auditar
- Simple de implementar

---

### Decisión 5: Claude opcional, no obligatorio

**Contexto:** ¿Hace falta Claude en el flujo crítico?

**Decisión:** ✅ **Claude se usa solo para tareas de soporte** (validación de NLP, sumarización de notas, priorización de leads). **NO está en el path crítico.**

**Razones:**
- Latencia: Claude añade 1-3s por llamada
- Costo: cada llamada cuesta
- Confiabilidad: una caída de Anthropic no debe tumbar las citas
- Determinismo: la lógica de slots es matemática, no IA

---

## 8. Consideraciones de Seguridad

### 8.1 Secretos

| Secreto | Dónde vive | Cómo se rota |
|---------|-----------|--------------|
| `SUPABASE_SERVICE_KEY` | Vercel env vars | Manual cada 90 días |
| `ANTHROPIC_API_KEY` | Vercel env vars | Manual cada 90 días |
| `GOOGLE_REFRESH_TOKEN` | Vercel env vars | Re-auth cuando expire |
| `GMAIL_APP_PASSWORD` | Vercel env vars | Manual cuando se reset |
| `WHATSAPP_TOKEN` | Vercel env vars | Cada 60 días (Meta) |

**Regla:** ningún secreto en repo. `.env.example` documenta nombres, no valores.

### 8.2 Row Level Security (Supabase)

- `bookings`: lectura solo para usuarios autenticados con rol `comercial` o `admin`
- `audit_log`: lectura solo para `admin`
- Insert desde API se hace con **service role key** (bypass RLS) desde backend

### 8.3 Validación de entrada

Toda entrada del formulario pasa por **Zod** o validación manual:
- Email: regex + DNS check (opcional)
- WhatsApp: solo dígitos, 10-15 caracteres
- Fecha: >= hoy, no fin de semana, no festivo
- Empresa: max 200 chars, sanitizada

### 8.4 Rate limiting

- 5 requests/min por IP en `/api/validate-availability`
- 3 requests/min por IP en `/api/confirm-booking`
- Vercel Edge Middleware o Upstash Redis

### 8.5 Auditoría

Cada acción registra en `audit_log`:
- `actor` (sistema, usuario, IP)
- `action` (create, update, delete, sync)
- `resource_type` y `resource_id`
- `payload_before` y `payload_after`
- `timestamp`

---

## 9. Documentos Relacionados

- [`SCHEMA_SUPABASE.md`](./SCHEMA_SUPABASE.md) — Schema completo de la base de datos
- [`ENDPOINTS_API.md`](./ENDPOINTS_API.md) — Especificación de la API
- [`FLUJOS_LOGICA.md`](./FLUJOS_LOGICA.md) — Pseudocódigo de cada flujo
- [`INTEGRACIONES_EXTERNAS.md`](./INTEGRACIONES_EXTERNAS.md) — Google Calendar y Gmail
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) — Cómo deployar
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) — Estrategia de testing
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) — Problemas comunes
- [`MIGRACION_DESDE_N8N.md`](./MIGRACION_DESDE_N8N.md) — Plan de migración
- [`README.md`](./README.md) — Inicio rápido

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
**Mantenido por:** Equipo Effi Diagnósticos
