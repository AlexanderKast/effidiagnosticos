import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  CRMPipeline,
  PIPELINE_COLORS,
  fetchPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
} from '@/lib/crmPipelinesService';

interface PipelineFormState {
  name: string;
  description: string;
  color: string;
}

const EMPTY_FORM: PipelineFormState = { name: '', description: '', color: PIPELINE_COLORS[0] };

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {PIPELINE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
          style={{ backgroundColor: c, borderColor: value === c ? '#000' : 'transparent' }}
        />
      ))}
    </div>
  );
}

function PipelineForm({
  form,
  setForm,
  onSave,
  onCancel,
  label,
  saving,
}: {
  form: PipelineFormState;
  setForm: (f: PipelineFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  label: string;
  saving: boolean;
}) {
  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nombre <span className="text-destructive">*</span></Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Pipeline Ventas Colombia"
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Descripción <span className="text-xs text-muted-foreground">(opcional)</span></Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Para qué sirve este pipeline"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Color</Label>
        <ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={saving || !form.name.trim()} className="gap-1.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {label}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function CRMPipelinesManager() {
  const [pipelines, setPipelines] = useState<CRMPipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<PipelineFormState>({ ...EMPTY_FORM });

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PipelineFormState>({ ...EMPTY_FORM });

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setPipelines(await fetchPipelines());
    } catch {
      toast.error('Error al cargar los pipelines');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      const created = await createPipeline(createForm);
      setPipelines((p) => [...p, created]);
      setCreateForm({ ...EMPTY_FORM });
      setShowCreate(false);
      toast.success(`Pipeline "${created.name}" creado`);
    } catch {
      toast.error('Error al crear el pipeline');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: CRMPipeline) => {
    setEditingId(p.id);
    setEditForm({ name: p.name, description: p.description ?? '', color: p.color });
  };

  const handleUpdate = async () => {
    if (!editingId || !editForm.name.trim()) return;
    setSaving(true);
    try {
      const updated = await updatePipeline(editingId, editForm);
      setPipelines((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingId(null);
      toast.success('Pipeline actualizado');
    } catch {
      toast.error('Error al actualizar el pipeline');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePipeline(deleteId);
      setPipelines((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success('Pipeline eliminado');
    } catch {
      toast.error('Error al eliminar el pipeline');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Pipelines CRM</h2>
          <p className="text-xs text-muted-foreground">
            Agrupa leads de múltiples bookings en un mismo pipeline
          </p>
        </div>
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Nuevo pipeline
          </Button>
        )}
      </div>

      {showCreate && (
        <PipelineForm
          form={createForm}
          setForm={setCreateForm}
          onSave={handleCreate}
          onCancel={() => { setShowCreate(false); setCreateForm({ ...EMPTY_FORM }); }}
          label="Crear pipeline"
          saving={saving}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : pipelines.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl text-muted-foreground text-sm">
          No hay pipelines creados aún.
        </div>
      ) : (
        <div className="space-y-2">
          {pipelines.map((p) =>
            editingId === p.id ? (
              <PipelineForm
                key={p.id}
                form={editForm}
                setForm={setEditForm}
                onSave={handleUpdate}
                onCancel={() => setEditingId(null)}
                label="Guardar cambios"
                saving={saving}
              />
            ) : (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl bg-card"
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(p)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(p.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              Los registros CRM asignados a este pipeline quedarán sin pipeline asignado.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
