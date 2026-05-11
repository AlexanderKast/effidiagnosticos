import { supabase } from '@/integrations/supabase/client';

export interface CommercialCalendar {
  id: string;
  commercial_id: number | null;
  name: string;
  email: string;
  calendar_id: string;
  status: 'active' | 'inactive';
  empresa: string | null;
  country: string;
  created_at: string;
  updated_at: string;
}

export type CommercialCalendarInput = Omit<CommercialCalendar, 'id' | 'created_at' | 'updated_at'>;

export const COUNTRY_NAMES: Record<string, string> = {
  CO: '🇨🇴 Colombia',
  MX: '🇲🇽 México',
  PE: '🇵🇪 Perú',
  AR: '🇦🇷 Argentina',
  CL: '🇨🇱 Chile',
  EC: '🇪🇨 Ecuador',
  VE: '🇻🇪 Venezuela',
  US: '🇺🇸 Estados Unidos',
  BO: '🇧🇴 Bolivia',
  PY: '🇵🇾 Paraguay',
  UY: '🇺🇾 Uruguay',
  CR: '🇨🇷 Costa Rica',
  PA: '🇵🇦 Panamá',
  DO: '🇩🇴 Rep. Dominicana',
};

export const getCountryName = (code: string) =>
  COUNTRY_NAMES[code.toUpperCase()] ?? `🌎 ${code.toUpperCase()}`;

// Agrupa comerciales por país
export const groupByCountry = (
  commercials: CommercialCalendar[]
): Record<string, CommercialCalendar[]> => {
  return commercials.reduce(
    (acc, c) => {
      const key = c.country.toUpperCase();
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    },
    {} as Record<string, CommercialCalendar[]>
  );
};

export const fetchCommercialCalendars = async (
  onlyActive = false
): Promise<CommercialCalendar[]> => {
  let query = supabase
    .from('commercial_calendars')
    .select('*')
    .order('country')
    .order('name');

  if (onlyActive) query = query.eq('status', 'active');

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CommercialCalendar[];
};

export const createCommercialCalendar = async (
  input: CommercialCalendarInput
): Promise<CommercialCalendar> => {
  const { data, error } = await supabase
    .from('commercial_calendars')
    .insert([input])
    .select()
    .single();
  if (error) throw error;
  return data as CommercialCalendar;
};

export const updateCommercialCalendar = async (
  id: string,
  updates: Partial<CommercialCalendarInput>
): Promise<CommercialCalendar> => {
  const { data, error } = await supabase
    .from('commercial_calendars')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CommercialCalendar;
};

export const deleteCommercialCalendar = async (id: string): Promise<void> => {
  const { error } = await supabase.from('commercial_calendars').delete().eq('id', id);
  if (error) throw error;
};

export const toggleCommercialStatus = async (
  id: string,
  currentStatus: 'active' | 'inactive'
): Promise<CommercialCalendar> => {
  return updateCommercialCalendar(id, {
    status: currentStatus === 'active' ? 'inactive' : 'active',
  });
};
