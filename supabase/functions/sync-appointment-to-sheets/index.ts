import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COUNTRY_NAMES: Record<string, string> = {
  CO: 'Colombia',
  MX: 'México',
  PE: 'Perú',
  AR: 'Argentina',
  CL: 'Chile',
  EC: 'Ecuador',
  VE: 'Venezuela',
  US: 'Estados Unidos',
  BO: 'Bolivia',
  PY: 'Paraguay',
  UY: 'Uruguay',
  CR: 'Costa Rica',
  PA: 'Panamá',
  GT: 'Guatemala',
  HN: 'Honduras',
};

const SHEET_HEADERS = [
  'booking_id', 'service_name', 'country', 'date', 'time', 'timezone',
  'duration_min', 'name', 'email', 'whatsapp', 'tipo_cliente', 'perfil_resumen',
  'empresa', 'ya_vende', 'tipo_pago', 'tiene_web', 'usa_chatbot', 'envios_mes',
  'tipo_comerciante', 'notes', 'assigned_user', 'assigned_calendar_id',
  'commercial_id', 'gcal_event_id', 'gcal_event_link', 'status', 'created_at',
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

  // Import RSA private key
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
  const sigB64 = base64url(sig);
  const jwt = `${message}.${sigB64}`;

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
  // Write headers on new tab
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

// ── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    // Supabase Database Webhook payload: { type, table, schema, record, old_record }
    const appt = body.record;
    if (!appt) return new Response('No record', { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch booking config → service_name + country
    const { data: bc } = await supabase
      .from('booking_configs')
      .select('name, country, gcal_calendar_id')
      .eq('booking_id', appt.booking_id)
      .single();

    // Fetch assigned commercial if present
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

    const fd: Record<string, string> = appt.form_data ?? {};
    const countryCode: string = bc?.country ?? 'CO';
    const countryTab = COUNTRY_NAMES[countryCode] ?? countryCode;

    const row = [
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
    ];

    // Authenticate
    const saKey = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')!);
    const token = await getGoogleAccessToken(saKey);
    const sheetId = Deno.env.get('GOOGLE_SHEETS_ID')!;

    // Ensure tab exists (creates it with headers if not)
    const existingTabs = await getSheetTabs(token, sheetId);
    if (!existingTabs.includes(countryTab)) {
      await createTab(token, sheetId, countryTab);
    }

    await appendRows(token, sheetId, countryTab, [row]);

    console.log(`✓ appointment ${appt.id} → tab "${countryTab}"`);
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
