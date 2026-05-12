import { supabase } from '@/integrations/supabase/client';
import { AppRole } from './types';

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  reports_to: string | null;
  reports_to_name: string | null;
  country: string | null;
  area: string | null;
  commercial_id: string | null;
  commercial_name: string | null;
  created_at: string;
}

export interface AssignRolePayload {
  userId: string;
  role: AppRole;
  reportsTo?: string | null;
  country?: string | null;
  area?: string | null;
}

export async function fetchUsersWithRoles(): Promise<UserWithRole[]> {
  const [profilesRes, rolesRes, commercialsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, email, full_name, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_roles')
      .select('user_id, role, reports_to, country, area'),
    supabase
      .from('commercial_calendars')
      .select('user_id, id, name')
      .not('user_id', 'is', null),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const rolesMap = new Map(
    (rolesRes.data ?? []).map((r) => [r.user_id, r])
  );
  const commercialsMap = new Map(
    (commercialsRes.data ?? []).map((c) => [c.user_id, c])
  );

  return (profilesRes.data ?? []).map((p) => {
    const roleRow = rolesMap.get(p.user_id);
    const commercialRow = commercialsMap.get(p.user_id);
    return {
      id: p.user_id,
      email: p.email ?? '',
      full_name: p.full_name ?? null,
      role: (roleRow?.role as AppRole | null) ?? null,
      reports_to: roleRow?.reports_to ?? null,
      reports_to_name: null,
      country: roleRow?.country ?? null,
      area: roleRow?.area ?? null,
      commercial_id: commercialRow?.id ?? null,
      commercial_name: commercialRow?.name ?? null,
      created_at: p.created_at,
    };
  });
}

export async function assignRole(payload: AssignRolePayload): Promise<void> {
  const existing = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', payload.userId)
    .maybeSingle();

  if (existing.data) {
    const { error } = await supabase
      .from('user_roles')
      .update({
        role: payload.role,
        reports_to: payload.reportsTo ?? null,
        country: payload.country ?? null,
        area: payload.area ?? null,
      })
      .eq('user_id', payload.userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: payload.userId,
        role: payload.role,
        reports_to: payload.reportsTo ?? null,
        country: payload.country ?? null,
        area: payload.area ?? null,
      });
    if (error) throw error;
  }
}

export async function linkToCommercial(userId: string, commercialId: string): Promise<void> {
  // Limpiar enlace previo si lo había
  const { error: clearError } = await supabase
    .from('commercial_calendars')
    .update({ user_id: null } as Record<string, unknown>)
    .eq('user_id', userId);
  if (clearError) throw clearError;

  const { error } = await supabase
    .from('commercial_calendars')
    .update({ user_id: userId } as Record<string, unknown>)
    .eq('id', commercialId);
  if (error) throw error;
}

export async function unlinkFromCommercial(userId: string): Promise<void> {
  const { error } = await supabase
    .from('commercial_calendars')
    .update({ user_id: null } as Record<string, unknown>)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateUserProfile(userId: string, fullName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName || null })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function fetchAvailableCommercials(): Promise<Array<{ id: string; name: string; email: string; country: string }>> {
  const { data, error } = await supabase
    .from('commercial_calendars')
    .select('id, name, email, country')
    .eq('status', 'active')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string; email: string; country: string }>;
}
