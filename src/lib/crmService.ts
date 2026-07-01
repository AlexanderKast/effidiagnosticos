import { supabase } from '@/integrations/supabase/client';
import { AppointmentCRM, CRMFields, CRMEstado, CRM_ESTADOS, MergeLeadsParams, MergeLeadsResult } from './crmUtils';

export interface CommercialOption {
  id: string;
  name: string;
  email: string;
}

export interface CRMFilters {
  estado?: string;
  soloVentas?: boolean;
  search?: string;
  verArchivados?: boolean;
}

export async function fetchCRMRecords(
  filters: CRMFilters & { bookingId?: string; pipelineId?: string | null } = {}
): Promise<AppointmentCRM[]> {
  let query = supabase
    .from('appointments')
    .select(`
      id, booking_id, crm_pipeline_id, lead_name, lead_email, lead_company, lead_notes,
      form_data, appointment_date, start_time, end_time, status,
      assigned_commercial_id, assigned_commercial_name, created_at, archived,
      gcal_event_id, gcal_html_link,
      crm_venta_realizada, crm_tipo_marketing, crm_tipo_cliente,
      crm_monto_venta, crm_estado_cliente, crm_observaciones, crm_canal_origen,
      booking_configs ( country )
    `)
    .eq('archived', filters.verArchivados ? true : false)
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (filters.pipelineId === '__none__') {
    query = query.is('crm_pipeline_id', null);
  } else if (filters.pipelineId) {
    query = query.eq('crm_pipeline_id', filters.pipelineId);
  }

  if (filters.bookingId) {
    query = query.eq('booking_id', filters.bookingId);
  }

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

  return (data ?? []).map((row: any) => {
    const { booking_configs, ...rest } = row;
    const bookingConfig = Array.isArray(booking_configs) ? booking_configs[0] : booking_configs;
    return { ...rest, booking_country: bookingConfig?.country ?? null };
  }) as AppointmentCRM[];
}

export async function updateAppointmentCRM(
  id: string,
  fields: Partial<CRMFields> & { assigned_commercial_id?: string | null; assigned_commercial_name?: string | null },
  canReassign = false
): Promise<void> {
  // Protección en capa de aplicación: solo líderes pueden reasignar
  if (!canReassign) {
    delete (fields as Record<string, unknown>).assigned_commercial_id;
    delete (fields as Record<string, unknown>).assigned_commercial_name;
  }
  const { data, error } = await supabase
    .from('appointments')
    .update(fields)
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No se actualizó el registro. Verifica permisos o recarga la página.');
  }
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

export async function archiveAppointment(id: string, archived: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('appointments')
    .update({ archived })
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No se pudo archivar el registro.');
  }
}

export async function updateAppointmentLead(
  id: string,
  fields: LeadEditFields,
  currentFormData: Record<string, unknown>
): Promise<void> {
  const phoneKey = 'whatsapp' in currentFormData ? 'whatsapp' : 'telefono';
  const newFormData = { ...currentFormData, [phoneKey]: fields.phone };

  const { data, error } = await supabase
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
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No se actualizó el lead. Verifica permisos o recarga la página.');
  }
}

function getEstadoMasAvanzado(a: CRMEstado | null, b: CRMEstado | null): CRMEstado | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const iA = CRM_ESTADOS.indexOf(a);
  const iB = CRM_ESTADOS.indexOf(b);
  // Índices 0-6 son estados de avance; 7-8 (Descartado, NO Interesado) solo se toman si no hay otro
  const advanceLimit = 7;
  const aIsNegative = iA >= advanceLimit;
  const bIsNegative = iB >= advanceLimit;
  if (!aIsNegative && bIsNegative) return a;
  if (aIsNegative && !bIsNegative) return b;
  return iA >= iB ? a : b;
}

export async function mergeLeads(params: MergeLeadsParams, canReassign: boolean): Promise<MergeLeadsResult> {
  const { winner, losers, assignCommercialId, assignCommercialName } = params;

  // Fusionar observaciones
  const allObs = [winner.crm_observaciones, ...losers.map((l) => l.crm_observaciones)]
    .filter(Boolean)
    .join('\n---\n');

  // Estado más avanzado
  let estado = winner.crm_estado_cliente;
  for (const l of losers) estado = getEstadoMasAvanzado(estado, l.crm_estado_cliente);

  // Monto y canal: tomar del primer loser que tenga valor si el winner está vacío
  let monto = winner.crm_monto_venta;
  let canal = winner.crm_canal_origen;
  for (const l of losers) {
    if (monto == null && l.crm_monto_venta != null) monto = l.crm_monto_venta;
    if (!canal && l.crm_canal_origen) canal = l.crm_canal_origen;
  }

  const winnerFields: Partial<AppointmentCRM> & { assigned_commercial_id?: string | null; assigned_commercial_name?: string | null } = {
    crm_observaciones: allObs || null,
    crm_estado_cliente: estado,
    crm_monto_venta: monto,
    crm_canal_origen: canal,
  };

  if (assignCommercialId !== undefined) {
    winnerFields.assigned_commercial_id = assignCommercialId;
    winnerFields.assigned_commercial_name = assignCommercialName ?? null;
  }

  await updateAppointmentCRM(winner.id, winnerFields, canReassign);

  const archivedIds: string[] = [];
  for (const loser of losers) {
    await archiveAppointment(loser.id, true);
    archivedIds.push(loser.id);

    // Si se reasigna comercial, actualizar también los losers antes de archivar
    if (canReassign && assignCommercialId !== undefined) {
      await updateAppointmentCRM(
        loser.id,
        { assigned_commercial_id: assignCommercialId, assigned_commercial_name: assignCommercialName ?? null },
        true,
      );
    }
  }

  return { updatedWinner: winnerFields, archivedIds };
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
