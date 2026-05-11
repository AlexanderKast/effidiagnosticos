import { useState, useEffect } from 'react';
import {
  CommercialGroup,
  CommercialGroupInput,
  fetchGroups,
  fetchGroupMembers,
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupMembers,
} from '@/lib/commercialGroupsService';
import {
  CommercialCalendar,
  fetchCommercialCalendars,
  getCountryName,
  groupByCountry,
} from '@/lib/commercialCalendarsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Pencil, Trash2, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM: CommercialGroupInput = { name: '', description: null, country: null };

export function CommercialGroupsManager() {
  const [groups, setGroups] = useState<CommercialGroup[]>([]);
  const [allCommercials, setAllCommercials] = useState<CommercialCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CommercialGroupInput>(EMPTY_FORM);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setIsLoading(true);
      const [g, c] = await Promise.all([fetchGroups(), fetchCommercialCalendars(true)]);
      setGroups(g);
      setAllCommercials(c);
    } catch {
      toast.error('Error al cargar grupos');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setSelectedMembers([]);
    setModalOpen(true);
  };

  const openEdit = async (g: CommercialGroup) => {
    setEditingId(g.id);
    setFormData({ name: g.name, description: g.description, country: g.country });
    const members = await fetchGroupMembers(g.id);
    setSelectedMembers(members);
    setModalOpen(true);
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('El nombre del grupo es requerido');
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error('Selecciona al menos un comercial');
      return;
    }
    setIsSaving(true);
    try {
      const saved = editingId
        ? await updateGroup(editingId, formData)
        : await createGroup(formData);
      await setGroupMembers(saved.id, selectedMembers);
      toast.success(editingId ? 'Grupo actualizado' : 'Grupo creado');
      setModalOpen(false);
      await load();
    } catch {
      toast.error('Error al guardar el grupo');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteGroup(deleteId);
      toast.success('Grupo eliminado');
      await load();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleteId(null);
    }
  };

  const groupedCommercials = groupByCountry(allCommercials);
  const countries = Object.keys(groupedCommercials).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">Grupos</h3>
          <p className="text-sm text-muted-foreground">
            Agrupa comerciales para asignación automática round-robin
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo grupo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
          No hay grupos creados. Crea uno para asignar varios comerciales a un booking.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{g.name}</span>
                    {!g.active && (
                      <Badge variant="outline" className="text-xs">Inactivo</Badge>
                    )}
                  </div>
                  {g.description && (
                    <p className="text-xs text-muted-foreground truncate">{g.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(g)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(g.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar grupo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar grupo' : 'Nuevo grupo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nombre del grupo</Label>
              <Input
                placeholder="Ej: Equipo Colombia, Soporte LATAM"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descripción (opcional)</Label>
              <Input
                placeholder="Ej: Comerciales de ventas en Colombia"
                value={formData.description ?? ''}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value || null }))
                }
              />
            </div>

            {/* Selección de miembros agrupados por país */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Comerciales del grupo
                  {selectedMembers.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedMembers.length} seleccionados
                    </Badge>
                  )}
                </Label>
              </div>

              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {countries.map((country) => (
                  <div key={country}>
                    <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                      {getCountryName(country)}
                    </p>
                    {groupedCommercials[country].map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedMembers.includes(c.id)}
                          onCheckedChange={() => toggleMember(c.id)}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.calendar_id}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                ))}
                {allCommercials.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No hay comerciales activos. Agrégalos primero en la pestaña Comerciales.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? 'Guardar cambios' : 'Crear grupo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Los bookings asignados a este grupo quedarán sin asignación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
