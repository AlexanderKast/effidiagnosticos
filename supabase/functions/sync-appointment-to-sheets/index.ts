import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COUNTRY_NAMES: Record<string, string> = {
  CO: 'Metricas COL',
  GT: 'Metricas GT',
  DO: 'Metricas RD',
  RD: 'Metricas RD',
  EC: 'Metricas EC',
  CR: 'Metricas CR',
  MX: 'México',
  PE: 'Perú',
  AR: 'Argentina',
  CL: 'Chile',
  VE: 'Venezuela',
  US: 'Estados Unidos',
  BO: 'Bolivia',
  PY: 'Paraguay',
  UY: 'Uruguay',
  PA: 'Panamá',
  HN: 'Honduras',
};

// id is first column so UPDATE can find rows by UUID
const SHEET_HEADERS = [
  'id',
  'booking_id', 'service_name', 'country', 'date', 'time', 'timezone',
  'duration_min', 'name', 'email', 'whatsapp', 'tipo_cliente', 'perfil_resumen',
  'empresa', 'ya_vende', 'tipo_pago', 'tiene_web', 'usa_chatbot', 'envios_mes',
  'tipo_comerciante', 'notes', 'assigned_user', 'assigned_calendar_id',
  'commercial_id', 'gcal_event_id', 'gcal_event_link', 'status', 'created_at',
  'crm_estado', 'crm_venta_realizada', 'crm_monto_venta',
  'crm_tipo_cliente', 'crm_tipo_marketing', 'crm_canal_origen', 'crm_observaciones',
];

// ── Google Service Account JWT + token ──────────────────────────────────────

async function getGoogleAccessToken(serviceAccountKey: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const headerB64 = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payloadB64 = base64url(JSON.stringify({
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  const message = `${headerB64}.${payloadB64}`;

  const pemBody = serviceAccountKey.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(message),
  );
  const jwt = `${message}.${base64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

function base64url(input: string | ArrayBuffer): string {
  let str: string;
  if (typeof input === 'string') {
    str = btoa(unescape(encodeURIComponent(input)));
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(input)));
  }
  return str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// ── Google Sheets helpers ───────────────────────────────────────────────────

async function sheetsRequest(
  token: string,
  method: string,
  url: string,
  body?: unknown,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function getSheetTabs(token: string, sheetId: string): Promise<string[]> {
  const res = await sheetsRequest(
    token,
    'GET',
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
  );
  const data = await res.json();
  return (data.sheets ?? []).map((s: any) => s.properties.title as string);
}

async function createTab(token: string, sheetId: string, tabName: string): Promise<void> {
  await sheetsRequest(
    token,
    'POST',
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    { requests: [{ addSheet: { properties: { title: tabName } } }] },
  );
  await appendRows(token, sheetId, tabName, [SHEET_HEADERS]);
}

async function appendRows(
  token: string,
  sheetId: string,
  tab: string,
  rows: string[][],
): Promise<void> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/` +
    `${encodeURIComponent(tab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await sheetsRequest(token, 'POST', url, { values: rows });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets append failed ${res.status}: ${err}`);
  }
}

function colLetter(n: number): string {
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// Searches column A for the appointment UUID. Returns 1-based row number or null.
async function findRowById(
  token: string,
  sheetId: string,
  tab: string,
  appointmentId: string,
): Promise<number | null> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/` +
    `${encodeURIComponent(tab)}!A:A`;
  const res = await sheetsRequest(token, 'GET', url);
  if (!res.ok) return null;
  const data = await res.json();
  const values: string[][] = data.values ?? [];
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === appointmentId) return i + 1;
  }
  return null;
}

async function updateRow(
  token: string,
  sheetId: string,
  tab: string,
  rowNumber: number,
  values: string[],
): Promise<void> {
  const lastCol = colLetter(values.length);
  const range = `${encodeURIComponent(tab)}!A${rowNumber}:${lastCol}${rowNumber}`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}` +
    `?valueInputOption=USER_ENTERED`;

  const res = await sheetsRequest(token, 'PUT', url, { values: [values] });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets update failed ${res.status}: ${err}`);
  }
}

// ── Row builder ─────────────────────────────────────────────────────────────

function buildRow(
  appt: Record<string, any>,
  bc: Record<string, any> | null,
  assignedUser: string,
  assignedCalendarId: string,
  commercialId: string,
  countryTab: string,
): string[] {
  const fd: Record<string, string> = appt.form_data ?? {};
  return [
    appt.id ?? '',
    appt.booking_id ?? '',
    bc?.name ?? '',
    countryTab,
    appt.appointment_date ?? '',
    appt.start_time ?? '',
    appt.timezone ?? '',
    String(appt.duration_minutes ?? ''),
    appt.lead_name ?? '',
    appt.lead_email ?? '',
    fd.whatsapp ?? '',
    fd.tipo_cliente ?? '',
    fd.perfil_resumen ?? '',
    appt.lead_company ?? fd.empresa ?? '',
    fd.ya_vende ?? '',
    fd.tipo_pago ?? '',
    fd.tiene_web ?? '',
    fd.usa_chatbot ?? '',
    fd.envios_mes ?? '',
    fd.tipo_comerciante ?? '',
    appt.lead_notes ?? fd.notes ?? '',
    assignedUser,
    assignedCalendarId,
    commercialId,
    appt.gcal_event_id ?? '',
    appt.gcal_html_link ?? '',
    appt.status ?? '',
    appt.created_at ?? '',
    appt.crm_estado_cliente ?? '',
    appt.crm_venta_realizada ? 'TRUE' : 'FALSE',
    appt.crm_monto_venta != null ? String(appt.crm_monto_venta) : '',
    appt.crm_tipo_cliente ?? '',
    appt.crm_tipo_marketing ?? '',
    appt.crm_canal_origen ?? '',
    appt.crm_observaciones ?? '',
  ];
}

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const eventType: string = body.type ?? 'INSERT';
    const appt = body.record;
    if (!appt) return new Response('No record', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: bc } = await supabase
      .from('booking_configs')
      .select('name, country, gcal_calendar_id')
      .eq('booking_id', appt.booking_id)
      .single();

    let assignedUser = '';
    let assignedCalendarId = bc?.gcal_calendar_id || '';
    let commercialId = '';

    if (appt.assigned_commercial_id) {
      const { data: cm } = await supabase
        .from('commercial_calendars')
        .select('name, calendar_id, commercial_id')
        .eq('id', appt.assigned_commercial_id)
        .single();
      if (cm) {
        assignedUser = cm.name;
        assignedCalendarId = cm.calendar_id;
        commercialId = cm.commercial_id?.toString() ?? '';
      }
    }

    const countryCode: string = bc?.country ?? 'CO';
    const countryTab = COUNTRY_NAMES[countryCode] ?? countryCode;
    const row = buildRow(appt, bc, assignedUser, assignedCalendarId, commercialId, countryTab);

    const saKey = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!);
    const token = await getGoogleAccessToken(saKey);
    const sheetId = Deno.env.get('GOOGLE_SHEETS_ID')!;

    const existingTabs = await getSheetTabs(token, sheetId);
    if (!existingTabs.includes(countryTab)) {
      await createTab(token, sheetId, countryTab);
    }

    if (eventType === 'UPDATE') {
      const rowNumber = await findRowById(token, sheetId, countryTab, appt.id);
      if (rowNumber) {
        await updateRow(token, sheetId, countryTab, rowNumber, row);
        console.log(`✓ UPDATE appointment ${appt.id} → row ${rowNumber} en "${countryTab}"`);
      } else {
        // Row not found (legacy row without id column) — append
        await appendRows(token, sheetId, countryTab, [row]);
        console.log(`✓ UPDATE→append appointment ${appt.id} (row no encontrada) en "${countryTab}"`);
      }
    } else {
      await appendRows(token, sheetId, countryTab, [row]);
      console.log(`✓ INSERT appointment ${appt.id} → tab "${countryTab}"`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('sync-appointment-to-sheets error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
