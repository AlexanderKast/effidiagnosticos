# 🧪 Testing Guide

> **Cómo testear, qué testear y por qué.**

---

## 📑 Tabla de Contenidos

1. [Filosofía de testing](#1-filosofía-de-testing)
2. [Stack de testing](#2-stack-de-testing)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Unit tests](#4-unit-tests)
5. [Integration tests](#5-integration-tests)
6. [E2E tests](#6-e2e-tests)
7. [Error tests](#7-error-tests)
8. [Performance tests](#8-performance-tests)
9. [Coverage targets](#9-coverage-targets)
10. [CI](#10-ci)

---

## 1. Filosofía de testing

| Principio | Significado |
|-----------|-------------|
| **Test la lógica, no las dependencias** | Mockear Supabase y Google es OK, pero validar lógica de negocio es lo importante |
| **El happy path no es suficiente** | Cada test crítico tiene su contraparte de error |
| **No mocks en integration tests** | Usar DB real (Supabase local o staging) |
| **Tests determinísticos** | Sin `Math.random` ni `new Date()` sin freezing |
| **Tests rápidos** | Suite unit < 30s. Integration < 2min |
| **Un test, una afirmación** | Si necesitas 5 asserts, probablemente son 5 tests |

---

## 2. Stack de testing

| Herramienta | Para qué |
|-------------|----------|
| **Vitest** | Unit + integration |
| **MSW** | Mock de HTTP (Google, WhatsApp) |
| **Supertest** | E2E HTTP |
| **Playwright** | E2E browser (opcional) |
| **k6** | Load testing |
| **@faker-js/faker** | Datos de prueba |

`package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run tests/e2e",
    "test:perf": "k6 run tests/perf/load.js"
  },
  "devDependencies": {
    "vitest": "^1.5.0",
    "@vitest/coverage-v8": "^1.5.0",
    "msw": "^2.2.0",
    "supertest": "^7.0.0",
    "@faker-js/faker": "^8.4.0"
  }
}
```

---

## 3. Estructura de carpetas

```
src/
├── lib/
│   ├── slots.ts
│   ├── slots.test.ts          ← unit junto al archivo
│   └── ...
└── api/
    ├── validate-availability.ts
    └── confirm-booking.ts

tests/
├── integration/
│   ├── booking-flow.test.ts
│   └── google-sync.test.ts
├── e2e/
│   ├── api.test.ts
│   └── full-funnel.test.ts
├── perf/
│   └── load.js
└── fixtures/
    ├── bookings.ts
    └── comerciales.ts
```

---

## 4. Unit tests

### 4.1 Validación de input

```typescript
// src/lib/validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateBookingInput } from './validation'

describe('validateBookingInput', () => {
  it('acepta input válido', () => {
    const result = validateBookingInput({
      nombre: 'Juan Pérez',
      email: 'juan@empresa.com',
      whatsapp: '+573001234567',
      fecha: '2026-06-01',
      hora: '10:00'
    })
    expect(result.success).toBe(true)
  })

  it('rechaza email inválido', () => {
    const result = validateBookingInput({
      nombre: 'Juan',
      email: 'no-es-email',
      whatsapp: '+573001234567',
      fecha: '2026-06-01',
      hora: '10:00'
    })
    expect(result.success).toBe(false)
    expect(result.error.field).toBe('email')
  })

  it('rechaza whatsapp con menos de 10 dígitos', () => {
    const result = validateBookingInput({
      nombre: 'Juan',
      email: 'juan@empresa.com',
      whatsapp: '+5713',
      fecha: '2026-06-01',
      hora: '10:00'
    })
    expect(result.success).toBe(false)
    expect(result.error.field).toBe('whatsapp')
  })

  it('rechaza nombre con menos de 2 caracteres', () => {
    const result = validateBookingInput({
      nombre: 'J',
      email: 'j@e.com',
      whatsapp: '+573001234567',
      fecha: '2026-06-01',
      hora: '10:00'
    })
    expect(result.success).toBe(false)
    expect(result.error.field).toBe('nombre')
  })
})
```

### 4.2 Generación de slots

```typescript
// src/lib/slots.test.ts
import { describe, it, expect } from 'vitest'
import { generarSlotsBase, estaEnAlmuerzo, filtrarSlotsDisponibles } from './slots'

describe('generarSlotsBase', () => {
  it('genera 16 slots de 30 min entre 9-17h', () => {
    const slots = generarSlotsBase(30)
    expect(slots).toHaveLength(16)
    expect(slots[0]).toBe('09:00')
    expect(slots.at(-1)).toBe('16:30')
  })

  it('genera 8 slots de 60 min', () => {
    const slots = generarSlotsBase(60)
    expect(slots).toHaveLength(8)
    expect(slots[0]).toBe('09:00')
    expect(slots.at(-1)).toBe('16:00')
  })
})

describe('estaEnAlmuerzo', () => {
  it('12:00 está en almuerzo', () => {
    expect(estaEnAlmuerzo('12:00')).toBe(true)
  })
  it('12:30 está en almuerzo', () => {
    expect(estaEnAlmuerzo('12:30')).toBe(true)
  })
  it('13:00 NO está en almuerzo', () => {
    expect(estaEnAlmuerzo('13:00')).toBe(false)
  })
  it('11:30 NO está en almuerzo', () => {
    expect(estaEnAlmuerzo('11:30')).toBe(false)
  })
})

describe('filtrarSlotsDisponibles', () => {
  it('excluye slots ocupados', () => {
    const slots = ['09:00', '09:30', '10:00']
    const ocupados = [{ hora: '09:30' }]
    const libres = filtrarSlotsDisponibles(slots, ocupados)
    expect(libres).toEqual(['09:00', '10:00'])
  })
})
```

### 4.3 Selección de comercial (round-robin)

```typescript
// src/lib/select-comercial.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { selectComercial } from './select-comercial'
import { supabase } from './supabase-client'

vi.mock('./supabase-client')

describe('selectComercial — round robin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('escoge el comercial con menos citas hoy', async () => {
    vi.mocked(supabase.from).mockImplementation((tabla) => {
      if (tabla === 'comerciales') {
        return mockSelect([
          { id: 'c1', nombre: 'Ana', activo: true, prioridad: 100, max_citas_dia: 8 },
          { id: 'c2', nombre: 'Bob', activo: true, prioridad: 100, max_citas_dia: 8 }
        ])
      }
      if (tabla === 'bookings') {
        return mockCount({ c1: 3, c2: 1 })
      }
    })

    const result = await selectComercial('2026-06-01', '10:00')
    expect(result.id).toBe('c2')   // bob tiene menos citas
  })

  it('retorna null si todos están saturados', async () => {
    vi.mocked(supabase.from).mockImplementation((tabla) => {
      if (tabla === 'comerciales') {
        return mockSelect([{ id: 'c1', nombre: 'Ana', activo: true, max_citas_dia: 2 }])
      }
      if (tabla === 'bookings') return mockCount({ c1: 2 })
    })

    const result = await selectComercial('2026-06-01', '10:00')
    expect(result).toBeNull()
  })
})
```

---

## 5. Integration tests

Estos sí tocan Supabase, pero contra una BD de test.

### 5.1 Setup

```typescript
// tests/integration/setup.ts
import { createClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, beforeEach } from 'vitest'

export const testDb = createClient(
  process.env.SUPABASE_TEST_URL!,
  process.env.SUPABASE_TEST_SERVICE_KEY!
)

beforeAll(async () => {
  await testDb.rpc('reset_test_db')
})

beforeEach(async () => {
  await testDb.from('bookings').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await testDb.from('calendar_events').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  await testDb.from('comerciales').upsert([
    { id: 'c1', nombre: 'Ana', email: 'ana@test.com', activo: true },
    { id: 'c2', nombre: 'Bob', email: 'bob@test.com', activo: true }
  ])
})
```

### 5.2 Flujo completo

```typescript
// tests/integration/booking-flow.test.ts
import { describe, it, expect } from 'vitest'
import { testDb } from './setup'
import { confirmBooking } from '../../src/api/confirm-booking'

describe('Flujo completo de booking', () => {
  it('valida disponibilidad → crea cita → genera audit log', async () => {
    // 1. Validar
    const slots = await fetch('/api/validate-availability', {
      method: 'POST',
      body: JSON.stringify({ fecha: '2026-06-01' })
    }).then(r => r.json())

    expect(slots.data.slots.length).toBeGreaterThan(0)

    // 2. Confirmar
    const result = await confirmBooking({
      body: {
        nombre: 'Juan Pérez',
        email: 'juan@empresa.com',
        whatsapp: '+573001234567',
        fecha: '2026-06-01',
        hora: '10:00',
        empresa: 'Acme'
      },
      headers: {}
    })

    expect(result.booking_id).toMatch(/^EFFI-\d{4}-\d{6}$/)
    expect(result.status).toBe('confirmed')

    // 3. Verificar en DB
    const { data: booking } = await testDb
      .from('bookings')
      .select('*')
      .eq('booking_id', result.booking_id)
      .single()

    expect(booking.email).toBe('juan@empresa.com')
    expect(booking.comercial_id).toBeTruthy()

    // 4. Verificar audit log
    const { data: audit } = await testDb
      .from('audit_log')
      .select('*')
      .eq('resource_id', booking.id)

    expect(audit.length).toBeGreaterThanOrEqual(1)
    expect(audit[0].action).toBe('create')

    // 5. Verificar calendar_events creado
    const { data: ce } = await testDb
      .from('calendar_events')
      .select('*')
      .eq('booking_id', booking.id)
      .single()

    expect(ce.sync_status).toBe('pending')
  })

  it('rechaza segundo booking en mismo slot', async () => {
    await confirmBooking({ body: { ...validBody, hora: '10:00' }, headers: {} })

    await expect(
      confirmBooking({ body: { ...validBody, hora: '10:00', email: 'otro@test.com' }, headers: {} })
    ).rejects.toThrow(/SLOT_TAKEN/)
  })

  it('rechaza duplicado por email + fecha', async () => {
    await confirmBooking({ body: { ...validBody, hora: '10:00' }, headers: {} })

    await expect(
      confirmBooking({ body: { ...validBody, hora: '11:00' }, headers: {} })
    ).rejects.toThrow(/DUPLICATE_BOOKING/)
  })
})
```

### 5.3 Sincronización con Google

```typescript
// tests/integration/google-sync.test.ts
import { describe, it, expect, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { syncToGoogleCalendar } from '../../src/jobs/sync-google'

const server = setupServer(
  http.post('https://www.googleapis.com/calendar/v3/calendars/*/events', () => {
    return HttpResponse.json({
      id: 'gevt_abc123',
      hangoutLink: 'https://meet.google.com/abc-defg-hij'
    })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Google sync', () => {
  it('marca synced tras éxito', async () => {
    const booking = await createTestBooking()
    await syncToGoogleCalendar(booking.id)

    const { data } = await testDb
      .from('calendar_events')
      .select('*')
      .eq('booking_id', booking.id)
      .single()

    expect(data.sync_status).toBe('synced')
    expect(data.google_event_id).toBe('gevt_abc123')
  })

  it('marca failed y incrementa attempts si Google devuelve 500', async () => {
    server.use(
      http.post('https://www.googleapis.com/calendar/v3/calendars/*/events', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    const booking = await createTestBooking()
    await syncToGoogleCalendar(booking.id)

    const { data } = await testDb
      .from('calendar_events')
      .select('*')
      .eq('booking_id', booking.id)
      .single()

    expect(data.sync_status).toBe('failed')
    expect(data.sync_attempts).toBe(1)
    expect(data.last_error).toContain('500')
  })
})
```

---

## 6. E2E tests

```typescript
// tests/e2e/api.test.ts
import request from 'supertest'
import { app } from '../../src/server'

describe('E2E /api', () => {
  it('GET /api/health → 200', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('healthy')
  })

  it('Funnel completo de booking', async () => {
    // Validar
    const v = await request(app)
      .post('/api/validate-availability')
      .send({ fecha: '2026-06-01' })
    expect(v.status).toBe(200)

    // Confirmar
    const c = await request(app)
      .post('/api/confirm-booking')
      .set('Idempotency-Key', 'test_' + Date.now())
      .send({
        nombre: 'Test User',
        email: 'test@example.com',
        whatsapp: '+573001234567',
        fecha: '2026-06-01',
        hora: '10:00'
      })
    expect(c.status).toBe(201)
    expect(c.body.data.booking_id).toBeTruthy()

    // Detalle
    const d = await request(app)
      .get(`/api/bookings/${c.body.data.booking_id}`)
      .set('Authorization', 'Bearer ' + process.env.TEST_JWT)
    expect(d.status).toBe(200)
  })
})
```

---

## 7. Error tests

Casos que **deben fallar de forma controlada**:

| Caso | Cómo simularlo | Resultado esperado |
|------|----------------|-------------------|
| Fecha en pasado | `fecha: '2020-01-01'` | 400 `INVALID_DATE` |
| Email inválido | `email: 'no-email'` | 400 `INVALID_EMAIL` |
| WhatsApp con letras | `whatsapp: 'abc123'` | 400 `INVALID_WHATSAPP` |
| Slot ocupado | crear primero, luego repetir | 409 `SLOT_TAKEN` |
| Duplicado | mismo email + fecha | 409 `DUPLICATE_BOOKING` |
| Sin comerciales | desactivar todos | 422 `NO_COMERCIAL_AVAILABLE` |
| Google timeout | MSW responde con delay > 30s | `sync_status: failed`, cita igual creada |
| Gmail down | mockear `transporter.sendMail` que falle | cita creada, email queue |
| Body XL (1MB+) | string gigante en notas | 413 Payload Too Large |
| SQL injection | `nombre: "'; DROP TABLE;"` | tratado como texto, sin daño |

---

## 8. Performance tests

### 8.1 Targets

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| `/api/health` | < 50ms | < 100ms | < 200ms |
| `/api/validate-availability` | < 300ms | < 600ms | < 1s |
| `/api/confirm-booking` | < 500ms | < 800ms | < 1.2s |

### 8.2 Load test con k6

```javascript
// tests/perf/load.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 50 },
    { duration: '1m',  target: 100 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed:   ['rate<0.01']
  }
}

export default function () {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const res = http.post(
    'http://localhost:8080/api/validate-availability',
    JSON.stringify({ fecha: tomorrow }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(res, {
    'status 200': r => r.status === 200,
    'has slots':  r => r.json('data.slots') !== null
  })

  sleep(1)
}
```

```bash
k6 run tests/perf/load.js
```

### 8.3 Test de concurrencia

Simular 100 usuarios intentando el mismo slot al mismo tiempo:

```javascript
// tests/perf/race-condition.js
import http from 'k6/http'

export const options = {
  vus: 100,
  iterations: 100,
  duration: '10s'
}

export default function () {
  const res = http.post('http://localhost:8080/api/confirm-booking',
    JSON.stringify({
      nombre: 'Test ' + __VU,
      email: `test${__VU}@e.com`,
      whatsapp: '+573001234567',
      fecha: '2026-06-01',
      hora: '10:00'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  // Solo 1 debe ser 201, el resto 409
  if (__VU === 1) check(res, { 'primer gana': r => r.status === 201 })
}
```

---

## 9. Coverage targets

| Métrica | Target | Crítico |
|---------|--------|---------|
| Statements | 80% | 70% |
| Branches | 75% | 65% |
| Functions | 85% | 75% |
| Lines | 80% | 70% |

```bash
npm run test:coverage
```

Vitest config (`vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 85,
        lines: 80
      },
      exclude: ['**/*.test.ts', 'tests/**', 'dist/**']
    }
  }
})
```

---

## 10. CI

Workflow recomendado en `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:coverage

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
        options: --health-cmd pg_isready
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:integration
        env:
          SUPABASE_TEST_URL: ${{ secrets.SUPABASE_TEST_URL }}
          SUPABASE_TEST_SERVICE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_KEY }}
```

---

## 📚 Documentos relacionados

- [`FLUJOS_LOGICA.md`](./FLUJOS_LOGICA.md)
- [`ENDPOINTS_API.md`](./ENDPOINTS_API.md)
- [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
