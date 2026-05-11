# 🚀 Deployment Guide

> **Cómo deployar el sistema de agendamiento.**

---

## 📑 Tabla de Contenidos

1. [Pre-requisitos](#1-pre-requisitos)
2. [Variables de entorno](#2-variables-de-entorno)
3. [Opción A: Deployment en Vercel (recomendado)](#3-opción-a-deployment-en-vercel-recomendado)
4. [Opción B: Deployment en VPS](#4-opción-b-deployment-en-vps)
5. [Verificaciones pre-deployment](#5-verificaciones-pre-deployment)
6. [Verificaciones post-deployment](#6-verificaciones-post-deployment)
7. [Monitoreo y alertas](#7-monitoreo-y-alertas)
8. [Rollback](#8-rollback)
9. [CI/CD](#9-cicd)

---

## 1. Pre-requisitos

| Cuenta / herramienta | Para qué | Link |
|----------------------|----------|------|
| Cuenta Vercel o VPS | Hosting | vercel.com |
| Proyecto Supabase | BD | supabase.com |
| Cuenta Google Cloud | Calendar API | console.cloud.google.com |
| App password Gmail | SMTP | myaccount.google.com |
| Meta Business | WhatsApp Cloud API | business.facebook.com |
| GitHub repo | Código | github.com |
| Node 20 LTS | Runtime | nodejs.org |
| npm 10+ | Package manager | included |

---

## 2. Variables de entorno

Crear archivo `.env.local` (dev) o configurar en panel del host (prod):

```bash
# ----- Supabase -----
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...                       # frontend
SUPABASE_SERVICE_KEY=eyJhbGc...                    # backend, NUNCA exponer

# ----- Anthropic (opcional) -----
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-opus-4-7

# ----- Google Calendar -----
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REFRESH_TOKEN=1//04xxx
GCAL_DEFAULT=primary

# ----- Gmail SMTP -----
GMAIL_USER=notificaciones@effidiagnosticos.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465

# ----- WhatsApp Cloud API -----
WHATSAPP_TOKEN=EAAxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345

# ----- App -----
NODE_ENV=production
PORT=8080
APP_URL=https://api.effidiagnosticos.com
LANDING_URL=https://effidiagnosticos.com
LOG_LEVEL=info

# ----- Seguridad -----
JWT_SECRET=cadena-larga-y-aleatoria-de-64-chars
ALLOWED_ORIGINS=https://effidiagnosticos.com,https://www.effidiagnosticos.com

# ----- Rate limiting (opcional con Upstash) -----
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx
```

### Checklist de validación

- [ ] Ninguna variable está vacía
- [ ] `SUPABASE_SERVICE_KEY` solo en backend (no en .env del frontend)
- [ ] `GOOGLE_REFRESH_TOKEN` está activo (probar con curl)
- [ ] `GMAIL_APP_PASSWORD` funciona (probar envío local)
- [ ] `ALLOWED_ORIGINS` cubre todos los dominios reales

---

## 3. Opción A: Deployment en Vercel (recomendado)

### 3.1 Primer deploy

**Paso 1 — Importar repo:**
1. Vercel → New Project → Import GitHub
2. Seleccionar `AlexanderKast/effidiagnosticos`
3. Framework: **Other** o **Node.js**
4. Root directory: `/`
5. Build command: `npm run build`
6. Output directory: `dist` (si aplica)
7. Install command: `npm install`

**Paso 2 — Configurar env vars:**
1. Settings → Environment Variables
2. Pegar todas las del paso 2
3. Marcar `Production`, `Preview`, `Development` según corresponda
4. **Importante:** marca `SUPABASE_SERVICE_KEY` como secret

**Paso 3 — Deploy:**
1. Click **Deploy**
2. Esperar 2-3 minutos
3. Verificar URL: `effidiagnosticos.vercel.app`

**Paso 4 — Configurar dominio:**
1. Settings → Domains
2. Add → `api.effidiagnosticos.com`
3. Configurar DNS CNAME → `cname.vercel-dns.com`
4. Esperar propagación (5-30 min)

### 3.2 Vercel Cron (workers)

Crear `vercel.json` en raíz:

```json
{
  "crons": [
    {
      "path": "/api/jobs/retry-sync",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/jobs/send-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/jobs/cleanup-old-locks",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

> Vercel Cron solo en planes **Pro** o superior.

### 3.3 Comandos útiles

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy a preview
vercel

# Deploy a producción
vercel --prod

# Ver logs en tiempo real
vercel logs --follow

# Ver vars del proyecto
vercel env ls
```

---

## 4. Opción B: Deployment en VPS

> Usa esta opción si necesitas más control, workers de larga duración o costos predecibles.

### 4.1 Preparar el servidor

```bash
# SSH al VPS
ssh root@194.163.161.151

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar
node -v   # v20.x.x
npm -v    # 10.x.x

# Instalar PM2 (process manager)
npm install -g pm2

# Instalar nginx (reverse proxy)
apt install -y nginx
```

### 4.2 Clonar y configurar

```bash
# Crear usuario para la app
useradd -m -s /bin/bash effi
su - effi

# Clonar
git clone https://github.com/AlexanderKast/effidiagnosticos.git
cd effidiagnosticos

# Instalar
npm ci --production

# Build
npm run build

# Crear .env
nano .env   # pegar las variables del paso 2
chmod 600 .env
```

### 4.3 Configurar PM2

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'effi-api',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '500M',
      error_file: '/home/effi/logs/effi-api-error.log',
      out_file:   '/home/effi/logs/effi-api-out.log',
      time: true
    },
    {
      name: 'effi-worker',
      script: 'dist/worker.js',
      instances: 1,
      env: { NODE_ENV: 'production' },
      cron_restart: '0 4 * * *',     // reinicia diariamente a las 4am
      time: true
    }
  ]
}
```

```bash
# Arrancar
pm2 start ecosystem.config.js

# Persistir entre reinicios
pm2 save
pm2 startup
# (copiar y ejecutar el comando que sugiere)

# Ver estado
pm2 status
pm2 logs effi-api --lines 50
```

### 4.4 Configurar nginx

`/etc/nginx/sites-available/api.effidiagnosticos.com`:

```nginx
upstream effi_api {
  server 127.0.0.1:8080;
  keepalive 32;
}

server {
  listen 80;
  server_name api.effidiagnosticos.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.effidiagnosticos.com;

  ssl_certificate     /etc/letsencrypt/live/api.effidiagnosticos.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.effidiagnosticos.com/privkey.pem;

  # Headers de seguridad
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Strict-Transport-Security "max-age=63072000" always;

  client_max_body_size 1M;

  location / {
    proxy_pass http://effi_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 30s;
  }

  # Health check sin logs
  location = /api/health {
    proxy_pass http://effi_api;
    access_log off;
  }
}
```

```bash
# Activar sitio
ln -s /etc/nginx/sites-available/api.effidiagnosticos.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL con Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.effidiagnosticos.com
```

### 4.5 Cron para workers (alternativa a PM2 dedicado)

```bash
crontab -e -u effi
```

```cron
*/5 * * * * curl -s http://localhost:8080/api/jobs/retry-sync     > /dev/null
0 8   * * * curl -s http://localhost:8080/api/jobs/send-reminders > /dev/null
*/30 * * * * curl -s http://localhost:8080/api/jobs/cleanup-locks > /dev/null
```

---

## 5. Verificaciones pre-deployment

Checklist antes de cada deploy a producción:

### Código
- [ ] Tests pasan: `npm test`
- [ ] Lint sin errores: `npm run lint`
- [ ] Type-check: `npm run typecheck`
- [ ] Build local funciona: `npm run build`
- [ ] No hay `console.log` olvidados
- [ ] No hay secrets hardcodeados
- [ ] CHANGELOG actualizado

### DB
- [ ] Migraciones aplicadas en staging
- [ ] Backup reciente del Postgres
- [ ] Plan de rollback documentado

### Integraciones
- [ ] Google `refresh_token` aún válido (probar)
- [ ] Gmail SMTP responde (probar)
- [ ] WhatsApp token válido (probar)

### Documentación
- [ ] README actualizado
- [ ] API docs actualizadas si hubo cambios

---

## 6. Verificaciones post-deployment

Después de cada deploy:

```bash
# 1. Health check
curl https://api.effidiagnosticos.com/api/health
# → { "success": true, "data": { "status": "healthy" } }

# 2. Validate availability (smoke test)
curl -X POST https://api.effidiagnosticos.com/api/validate-availability \
  -H "Content-Type: application/json" \
  -d '{"fecha":"2026-05-20"}'

# 3. Logs sin errores
vercel logs --follow              # Vercel
pm2 logs effi-api --lines 100     # VPS

# 4. Métricas
# - Latencia p95 < 800ms
# - Error rate < 0.5%

# 5. Verificar primera cita real
# (idealmente con cuenta de prueba interna)
```

### Smoke test automático

`scripts/smoke-test.sh`:

```bash
#!/bin/bash
set -e

URL=${1:-https://api.effidiagnosticos.com}
echo "Smoke testing $URL"

# Health
echo -n "Health check... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL/api/health)
[ "$STATUS" = "200" ] && echo "✓" || (echo "✗ ($STATUS)" && exit 1)

# Availability
echo -n "Availability... "
TOMORROW=$(date -d "+1 day" +%Y-%m-%d)
RESPONSE=$(curl -s -X POST $URL/api/validate-availability \
  -H "Content-Type: application/json" \
  -d "{\"fecha\":\"$TOMORROW\"}")
echo $RESPONSE | grep -q '"success":true' && echo "✓" || (echo "✗" && exit 1)

echo "All checks passed ✓"
```

---

## 7. Monitoreo y alertas

### 7.1 Vercel Analytics
- Latencia por endpoint
- Error rate
- Tráfico geográfico

### 7.2 Supabase Logs
- Queries lentas
- Errores SQL
- Conexiones activas

### 7.3 Alertas recomendadas

| Métrica | Umbral | Canal |
|---------|--------|-------|
| Health check fail | 2 fallos consecutivos | Slack + email |
| Error rate > 2% | 5 min sostenido | Slack |
| Latencia p95 > 1s | 10 min sostenido | Slack |
| `calendar_events` con `failed` > 10 | Acumulado | Slack + email urgente |
| Google `refresh_token` 401 | Inmediato | SMS + email urgente |
| Tabla `bookings` > 80% conexiones | Inmediato | Slack |

### 7.4 Dashboard sencillo (Supabase SQL)

```sql
-- Citas creadas hoy
SELECT COUNT(*) AS citas_hoy
FROM bookings
WHERE DATE(created_at) = CURRENT_DATE;

-- Citas pendientes de sync con Google
SELECT COUNT(*) AS pendientes
FROM calendar_events
WHERE sync_status IN ('pending', 'failed');

-- Top errores de últimas 24h
SELECT
  metadata->>'error' AS error,
  COUNT(*) AS veces
FROM audit_log
WHERE action = 'error' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY metadata->>'error'
ORDER BY veces DESC
LIMIT 10;
```

---

## 8. Rollback

### Vercel
```bash
# Listar deploys
vercel ls

# Promover deploy anterior
vercel promote <deployment-url>
```

### VPS
```bash
# Volver al commit anterior
git log --oneline -5
git checkout <hash-anterior>
npm ci --production
npm run build
pm2 reload effi-api
```

### DB
> **Cuidado:** las migraciones SQL deben ser reversibles cuando sea posible.

Cada migración debe tener su `*_rollback.sql`. Ejemplo:

```sql
-- 002_add_zoom_link.sql
ALTER TABLE bookings ADD COLUMN zoom_link TEXT;

-- 002_add_zoom_link_rollback.sql
ALTER TABLE bookings DROP COLUMN zoom_link;
```

---

## 9. CI/CD

### GitHub Actions (`.github/workflows/deploy.yml`)

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test -- --coverage

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token:    ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id:   ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  smoke-test:
    needs: deploy
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash scripts/smoke-test.sh https://api.effidiagnosticos.com
```

---

## 📚 Documentos relacionados

- [`ARQUITECTURA_GENERAL.md`](./ARQUITECTURA_GENERAL.md)
- [`TESTING_GUIDE.md`](./TESTING_GUIDE.md)
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
- [`MIGRACION_DESDE_N8N.md`](./MIGRACION_DESDE_N8N.md)

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
