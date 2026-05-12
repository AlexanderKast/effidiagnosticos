import { supabase } from '@/integrations/supabase/client';

export interface CRMPipeline {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export const PIPELINE_COLORS = [
  '#6366f1', '#3b82f6', '#14b8a6', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6',
];

export async function fetchPipelines(): Promise<CRMPipeline[]> {
  const { data, error } = await supabase
    .from('crm_pipelines')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CRMPipeline[];
}

export async function createPipeline(
  input: { name: string; description?: string; color?: string }
): Promise<CRMPipeline> {
  const { data, error } = await supabase
    .from('crm_pipelines')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      color: input.color ?? '#6366f1',
    })
    .select()
    .single();
  if (error) throw error;
  return data as CRMPipeline;
}

export async function updatePipeline(
  id: string,
  input: { name?: string; description?: string | null; color?: string }
): Promise<CRMPipeline> {
  const { data, error } = await supabase
    .from('crm_pipelines')
    .update({
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description?.trim() || null }),
      ...(input.color !== undefined && { color: input.color }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as CRMPipeline;
}

export async function deletePipeline(id: string): Promise<void> {
  const { error } = await supabase.from('crm_pipelines').delete().eq('id', id);
  if (error) throw error;
}
