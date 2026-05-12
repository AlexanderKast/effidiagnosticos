import { supabase } from '@/integrations/supabase/client';
import { AppointmentCRM, CRMFields } from './crmUtils';

export interface CommercialOption {
  id: string;
  name: string;
  email: string;
}

export interface CRMFilters {
  estado?: string;
  soloVentas?: boolean;
  search?: string;
}

export async function fetchAppointmentsByBooking(
  bookingId: string,
  filters: CRMFilters = {}
): Promise<AppointmentCRM[]> {
  let query = supabase
    .from('appointments')
    .select(`
      id, booking_id, lead_name, lead_email, lead_company, lead_notes,
      form_data, appointment_date, start_time, end_time, status,
      assigned_commercial_id, assigned_commercial_name, created_at,
      crm_venta_realizada, crm_tipo_marketing, crm_tipo_cliente,
      crm_monto_venta, crm_estado_cliente, crm_observaciones, crm_canal_origen
    `)
    .eq('booking_id', bookingId)
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (filters.estado) {
    query = query.eq('crm_estado_cliente', filters.estado);
  }

  if (filters.soloVentas) {
    query = query.eq('crm_venta_realizada', true);
  }

  if (filters.search) {
    query = query.or(
      `lead_name.ilike.%${filters.search}%,lead_email.ilike.%${filters.search}%,assigned_commercial_name.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as AppointmentCRM[];
}

export async function updateAppointmentCRM(
  id: string,
  fields: Partial<CRMFields> & { assigned_commercial_id?: string | null; assigned_commercial_name?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}

export interface LeadEditFields {
  lead_name: string;
  lead_email: string;
  lead_company: string | null;
  appointment_date: string;
  start_time: string;
  phone: string;
  assigned_commercial_id: string | null;
  assigned_commercial_name: string | null;
}

export async function updateAppointmentLead(
  id: string,
  fields: LeadEditFields,
  currentFormData: Record<string, unknown>
): Promise<void> {
  const phoneKey = 'whatsapp' in currentFormData ? 'whatsapp' : 'telefono';
  const newFormData = { ...currentFormData, [phoneKey]: fields.phone };

  const { error } = await supabase
    .from('appointments')
    .update({
      lead_name: fields.lead_name,
      lead_email: fields.lead_email,
      lead_company: fields.lead_company || null,
      appointment_date: fields.appointment_date,
      start_time: fields.start_time,
      assigned_commercial_id: fields.assigned_commercial_id,
      assigned_commercial_name: fields.assigned_commercial_name,
      form_data: newFormData,
    })
    .eq('id', id);

  if (error) throw error;
}

/** Obtiene la lista de comerciales asignables al pipeline de un booking */
export async function fetchCommercialsForBooking(bookingId: string): Promise<CommercialOption[]> {
  // Obtener assignment_type y commercial_group_id del booking
  const { data: config, error: configError } = await supabase
    .from('booking_configs')
    .select('assignment_type, commercial_group_id, gcal_calendar_id')
    .eq('booking_id', bookingId)
    .single();

  if (configError || !config) return [];

  if (config.assignment_type === 'group' && config.commercial_group_id) {
    // Grupo: obtener todos los miembros activos del grupo
    const { data, error } = await supabase
      .from('commercial_group_members')
      .select(`
        commercial_calendars!inner(id, name, email, status)
      `)
      .eq('group_id', config.commercial_group_id)
      .eq('commercial_calendars.status', 'active');

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => {
      const cal = row.commercial_calendars as Record<string, unknown>;
      return { id: cal.id as string, name: cal.name as string, email: cal.email as string };
    });
  }

  // Individual: buscar el comercial por gcal_calendar_id
  if (config.gcal_calendar_id) {
    const { data, error } = await supabase
      .from('commercial_calendars')
      .select('id, name, email')
      .eq('calendar_id', config.gcal_calendar_id)
      .eq('status', 'active');

    if (error || !data) return [];
    return data as CommercialOption[];
  }

  return [];
}
