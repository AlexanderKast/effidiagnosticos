import { supabase } from '@/integrations/supabase/client';
import { CommercialCalendar } from './commercialCalendarsService';

export interface CommercialGroup {
  id: string;
  name: string;
  description: string | null;
  country: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
  members?: CommercialCalendar[];
}

export interface CommercialGroupInput {
  name: string;
  description?: string | null;
  country?: string | null;
  active?: boolean;
}

export const fetchGroups = async (): Promise<CommercialGroup[]> => {
  const { data, error } = await supabase
    .from('commercial_groups')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as CommercialGroup[];
};

export const fetchGroupWithMembers = async (groupId: string): Promise<CommercialGroup | null> => {
  const { data: group, error } = await supabase
    .from('commercial_groups')
    .select('*')
    .eq('id', groupId)
    .single();
  if (error || !group) return null;

  const { data: memberRows } = await supabase
    .from('commercial_group_members')
    .select('commercial_id, commercial_calendars(*)')
    .eq('group_id', groupId);

  return {
    ...(group as CommercialGroup),
    members: (memberRows ?? []).map((r: any) => r.commercial_calendars),
  };
};

export const fetchGroupMembers = async (groupId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('commercial_group_members')
    .select('commercial_id')
    .eq('group_id', groupId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.commercial_id);
};

export const createGroup = async (input: CommercialGroupInput): Promise<CommercialGroup> => {
  const { data, error } = await supabase
    .from('commercial_groups')
    .insert([{ ...input, active: input.active ?? true }])
    .select()
    .single();
  if (error) throw error;
  return data as CommercialGroup;
};

export const updateGroup = async (
  id: string,
  updates: Partial<CommercialGroupInput>
): Promise<CommercialGroup> => {
  const { data, error } = await supabase
    .from('commercial_groups')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CommercialGroup;
};

export const deleteGroup = async (id: string): Promise<void> => {
  const { error } = await supabase.from('commercial_groups').delete().eq('id', id);
  if (error) throw error;
};

export const setGroupMembers = async (
  groupId: string,
  commercialIds: string[]
): Promise<void> => {
  // Delete all existing members then insert new ones
  await supabase.from('commercial_group_members').delete().eq('group_id', groupId);

  if (commercialIds.length === 0) return;

  const { error } = await supabase.from('commercial_group_members').insert(
    commercialIds.map((commercial_id) => ({ group_id: groupId, commercial_id }))
  );
  if (error) throw error;
};
