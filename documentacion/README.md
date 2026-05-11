# 📅 Sistema de Agendamiento — Effi Diagnósticos

> **Reemplazo de N8N + Google Calendar por Claude + Supabase como source of truth.**

---

## ❓ ¿Qué es esto?

Un sistema de agendamiento de citas comerciales construido para **no caerse cada 8 días**.

El sistema anterior dependía de un workflow N8N que se rompía cada vez que el refresh token de Google expiraba. La consecuencia: formularios fallando, leads perdidos, comerciales sin agenda.

Esta nueva versión usa **Supabase como verdad absoluta** y hace de Google Calendar un consumidor opcional. Si Google falla, las citas siguen creándose.

---

## 🎯 Problema que resuelve

| Antes (N8N) | Ahora (Claude + Supabase) |
|-------------|---------------------------|
| 🔴 Caídas cada ~8 días por token Google | ✅ Supabase nunca expira credenciales |
| 🔴 Google Sheets como BD (no escala) | ✅ Postgres profesional |
| 🔴 Sin auditoría centralizada | ✅ `audit_log` inmutable |
| 🔴 Sin reintentos automáticos | ✅ Worker con backoff exponencial |
| 🔴 Difícil de debuggear | ✅ Logs estructurados + request_id |
| 🔴 Acoplado a Google | ✅ Google es opcional |

---

## ⚡ Quick start (5 pasos)

### 1. Clonar y entrar
```bash
git clone https://github.com/AlexanderKast/effidiagnosticos.git
cd effidiagnosticos
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar `.env`
Copiar `.env.example` a `.env.local` y llenar las variables (ver [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#2-variables-de-entorno)).

```bash
cp .env.example .env.local
nano .env.local
```

### 4. Crear schema en Supabase
1. Crear proyecto en https://supabase.com
2. SQL Editor → pegar [`SCHEMA_SUPABASE.md` → sección 15](./SCHEMA_SUPABASE.md#15-script-de-instalación-completo)
3. Run

### 5. Levantar el servidor
```bash
npm run dev
```

Verificar con:
```bash
curl http://localhost:8080/api/health
# → { "success": true, "data": { "status": "healthy" } }
```

---

## 📚 Documentación

| Documento | Para qué |
|-----------|----------|
| 🏗️ [ARQUITECTURA_GENERAL](./ARQUITECTURA_GENERAL.md) | Visión completa del sistema |
| 🗄️ [SCHEMA_SUPABASE](./SCHEMA_SUPABASE.md) | Tablas SQL y relaciones |
| 🔌 [ENDPOINTS_API](./ENDPOINTS_API.md) | Specs de cada endpoint REST |
| 🔄 [FLUJOS_LOGICA](./FLUJOS_LOGICA.md) | Pseudocódigo de cada flujo |
| 🔗 [INTEGRACIONES_EXTERNAS](./INTEGRACIONES_EXTERNAS.md) | Google Calendar, Gmail, WhatsApp |
| 🚀 [DEPLOYMENT_GUIDE](./DEPLOYMENT_GUIDE.md) | Vercel y VPS paso a paso |
| 🧪 [TESTING_GUIDE](./TESTING_GUIDE.md) | Unit, integration, E2E, performance |
| 🚨 [TROUBLESHOOTING](./TROUBLESHOOTING.md) | Cómo resolver problemas comunes |
| 🔄 [MIGRACION_DESDE_N8N](./MIGRACION_DESDE_N8N.md) | Plan de migración sin downtime |

---

## 🛠️ Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend (landing) | HTML + JS vanilla / Next.js |
| API | **Node.js 20 + Express + TypeScript** |
| BD | **Supabase (Postgres 15)** |
| Hosting | **Vercel** (recomendado) o VPS |
| Calendar | Google Calendar API (async) |
| Email | Nodemailer + Gmail SMTP |
| WhatsApp | WhatsApp Cloud API (Meta) |
| Tests | Vitest + MSW + Supertest |
| Monitoreo | Vercel Analytics + Supabase logs |

---

## 🏃 Comandos útiles

```bash
# Desarrollo
npm run dev                    # arranca dev server en :8080
npm run dev:watch              # con hot reload

# Build y producción
npm run build                  # build a /dist
npm start                      # arranca el server desde /dist

# Tests
npm test                       # unit + integration
npm run test:watch             # watch mode
npm run test:coverage          # con coverage report
npm run test:e2e               # E2E
npm run test:perf              # k6 load test

# Quality
npm run lint                   # ESLint
npm run typecheck              # TypeScript check
npm run format                 # Prettier

# DB
npm run db:migrate             # aplica migraciones
npm run db:seed                # datos de prueba
npm run db:reset               # reset (solo dev)

# Deploy
npm run deploy:preview         # vercel preview
npm run deploy:prod            # vercel --prod
```

---

## 🗂️ Estructura del proyecto

```
effidiagnosticos/
├── documentacion/          ← este folder
├── src/
│   ├── api/                ← endpoints
│   ├── jobs/               ← workers (cron)
│   ├── lib/                ← lógica de negocio
│   ├── types/              ← types compartidos
│   └── server.ts
├── tests/
│   ├── integration/
│   ├── e2e/
│   └── perf/
├── migrations/             ← SQL files
├── scripts/
│   ├── smoke-test.sh
│   ├── clean_csv.py
│   └── import_legacy.ts
├── .env.example
├── vercel.json
└── package.json
```

---

## 🤝 Cómo contribuir

1. **Crear una branch:** `git checkout -b feat/mi-feature`
2. **Hacer cambios:** seguir convenciones del repo
3. **Tests:** `npm test` debe pasar al 100%
4. **Lint:** `npm run lint` sin errores
5. **Commit:** mensaje descriptivo, en español
6. **PR:** describir qué y por qué, no qué archivos cambiaron

### Convenciones de código

- TypeScript estricto
- Funciones pequeñas (< 50 líneas)
- Sin `any` salvo justificación
- Logs con `request_id`
- Errores con `AppError(code, message, status)`

### Convenciones de commit

```
feat: nueva funcionalidad
fix:  bug fix
docs: solo documentación
refactor: cambio sin alterar comportamiento
test: agrega o modifica tests
chore: tareas de mantenimiento
```

Ejemplo: `fix: prevenir doble booking cuando dos requests llegan al mismo tiempo`

---

## 📊 Métricas y objetivos

| Métrica | Objetivo |
|---------|----------|
| Uptime | > 99.9% |
| Latencia p95 | < 800ms |
| Error rate | < 0.5% |
| Citas creadas / día | ~ 20-50 |
| Tiempo medio confirmación | < 2s |
| Sincronización Google | < 30s p95 |

---

## 🔒 Seguridad

- ✅ HTTPS obligatorio
- ✅ Rate limiting (5 req/min público, configurable)
- ✅ RLS en Supabase para tablas sensibles
- ✅ Service role key solo en backend, nunca expuesta
- ✅ Validación con Zod en todos los endpoints
- ✅ Audit log inmutable
- ✅ Secrets en env vars del host, no en repo

Reportar vulnerabilidades a: **security@effidiagnosticos.com**

---

## 📞 Soporte

| Canal | Para qué |
|-------|----------|
| Slack `#tech-effi` | Bugs y dudas dev |
| Email `tech@effidiagnosticos.com` | Reportes formales |
| Issue en GitHub | Bugs reproducibles |
| `support@effidiagnosticos.com` | Soporte general |

---

## 📜 Licencia

Propietario — Effi Diagnósticos S.A.S. Uso interno.

---

## 🙏 Créditos

- **Owner del producto:** Equipo comercial Effi
- **Arquitectura y desarrollo:** Equipo Tech
- **Documentación:** generada con Claude Code, mantenida por el equipo

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
