import { supabase } from '@/integrations/supabase/client';
import { AppointmentCRM, CRMFields } from './crmUtils';

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
      crm_monto_venta, crm_estado_cliente, crm_observaciones
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
  fields: Partial<CRMFields>
): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update(fields)
    .eq('id', id);

  if (error) throw error;
}
