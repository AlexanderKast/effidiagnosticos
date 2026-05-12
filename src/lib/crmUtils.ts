export type CRMEstado =
  | 'Cerrado'
  | 'Proceso de cierre'
  | 'Descartado'
  | 'Gestión'
  | 'Pendiente de respuesta'
  | 'Cliente registrado'
  | 'NO Interesado'
  | 'Trabajo'
  | 'Mentorias';

export type CRMTipoCliente =
  | 'Mercaderia Propia'
  | 'Free Ecommerce'
  | 'Dropshipping'
  | 'Servicios Effi'
  | 'Mixto';

export const CRM_ESTADOS: CRMEstado[] = [
  'Pendiente de respuesta',
  'Gestión',
  'Proceso de cierre',
  'Cerrado',
  'Cliente registrado',
  'Trabajo',
  'Mentorias',
  'Descartado',
  'NO Interesado',
];

export const CRM_TIPOS_CLIENTE: CRMTipoCliente[] = [
  'Mercaderia Propia',
  'Free Ecommerce',
  'Dropshipping',
  'Servicios Effi',
  'Mixto',
];

export const CRM_TIPOS_MARKETING = [
  'Facebook Ads',
  'Google Ads',
  'TikTok Ads',
  'Referido',
  'Orgánico',
  'WhatsApp',
  'Email',
  'Otro',
];

export type CRMCanalOrigen =
  | 'WhatsApp'
  | 'Calendario'
  | 'Instagram'
  | 'Facebook'
  | 'TikTok'
  | 'Referido'
  | 'Llamada'
  | 'Email'
  | 'Otro';

export const CRM_CANALES: CRMCanalOrigen[] = [
  'WhatsApp',
  'Calendario',
  'Instagram',
  'Facebook',
  'TikTok',
  'Referido',
  'Llamada',
  'Email',
  'Otro',
];

export const CANAL_ICONS: Record<CRMCanalOrigen, string> = {
  WhatsApp: '💬',
  Calendario: '📅',
  Instagram: '📸',
  Facebook: '👤',
  TikTok: '🎵',
  Referido: '🤝',
  Llamada: '📞',
  Email: '✉️',
  Otro: '🔗',
};

export const ESTADO_COLORS: Record<CRMEstado, string> = {
  'Cerrado': 'bg-green-100 text-green-800 border-green-200',
  'Proceso de cierre': 'bg-blue-100 text-blue-800 border-blue-200',
  'Descartado': 'bg-red-100 text-red-800 border-red-200',
  'Gestión': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Pendiente de respuesta': 'bg-orange-100 text-orange-800 border-orange-200',
  'Cliente registrado': 'bg-purple-100 text-purple-800 border-purple-200',
  'NO Interesado': 'bg-gray-100 text-gray-600 border-gray-200',
  'Trabajo': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'Mentorias': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

export interface CRMFields {
  crm_venta_realizada: boolean;
  crm_tipo_marketing: string | null;
  crm_tipo_cliente: CRMTipoCliente | null;
  crm_monto_venta: number | null;
  crm_estado_cliente: CRMEstado | null;
  crm_observaciones: string | null;
  crm_canal_origen: CRMCanalOrigen | null;
}

export interface AppointmentCRM extends CRMFields {
  id: string;
  booking_id: string;
  lead_name: string;
  lead_email: string;
  lead_company: string | null;
  lead_notes: string | null;
  form_data: Record<string, unknown>;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  assigned_commercial_id: string | null;
  assigned_commercial_name: string | null;
  created_at: string;
  archived: boolean;
  gcal_event_id: string | null;
  gcal_html_link: string | null;
}

const PHONE_CANDIDATES = [
  'phone', 'telefono', 'teléfono', 'tel', 'whatsapp',
  'celular', 'movil', 'móvil', 'numero', 'número', 'number', 'contacto',
];

export function extractPhone(formData: Record<string, unknown>): string | null {
  for (const key of PHONE_CANDIDATES) {
    const val = formData[key];
    if (val && typeof val === 'string' && val.trim().length > 0) return val.trim();
  }
  for (const key of Object.keys(formData)) {
    const lk = key.toLowerCase();
    if (lk.includes('phone') || lk.includes('tel') || lk.includes('cel') || lk.includes('whats') || lk.includes('movil') || lk.includes('móvil')) {
      const val = formData[key];
      if (val && typeof val === 'string' && val.trim().length > 0) return val.trim();
    }
  }
  return null;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}
