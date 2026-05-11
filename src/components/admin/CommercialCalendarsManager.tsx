import { useState, useEffect } from 'react';
import {
  CommercialCalendar,
  CommercialCalendarInput,
  fetchCommercialCalendars,
  createCommercialCalendar,
  updateCommercialCalendar,
  deleteCommercialCalendar,
  toggleCommercialStatus,
  groupByCountry,
  getCountryName,
  COUNTRY_NAMES,
} from '@/lib/commercialCalendarsService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Pencil, Trash2, Loader2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY_FORM: CommercialCalendarInput = {
  commercial_id: null,
  name: '',
  email: '',
  calendar_id: '',
  status: 'active',
  empresa: null,
  country: 'CO',
};

export function CommercialCalendarsManager() {
  const [commercials, setCommercials] = useState<CommercialCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CommercialCalendarInput>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setIsLoading(true);
      setCommercials(await fetchCommercialCalendars());
    } catch {
      toast.error('Error al cargar comerciales');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (c: CommercialCalendar) => {
    setEditingId(c.id);
    setFormData({
      commercial_id: c.commercial_id,
      name: c.name,
      email: c.email,
      calendar_id: c.calendar_id,
      status: c.status,
      empresa: c.empresa,
      country: c.country,
    });
    setModalOpen(true);
  };

  const handleEmailBlur = () => {
    // Auto-rellenar calendar_id con el email si está vacío
    if (formData.email && !formData.calendar_id) {
      setFormData((p) => ({ ...p, calendar_id: p.email }));
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.calendar_id.trim()) {
      toast.error('Nombre, email y Calendar ID son requeridos');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await updateCommercialCalendar(editingId, formData);
        toast.success('Comercial actualizado');
      } else {
        await createCommercialCalendar(formData);
        toast.success('Comercial agregado');
      }
      setModalOpen(false);
      await load();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (c: CommercialCalendar) => {
    try {
      await toggleCommercialStatus(c.id, c.status);
      await load();
    } catch {
      toast.error('Error al cambiar estado');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCommercialCalendar(deleteId);
      toast.success('Comercial eliminado');
      await load();
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleteId(null);
    }
  };

  const grouped = groupByCountry(commercials);
  const countries = Object.keys(grouped).sort();
  const activeCount = commercials.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Comerciales</h2>
          <p className="text-sm text-muted-foreground">
            {commercials.length} registrados · {activeCount} activos
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Agregar comercial
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : commercials.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No hay comerciales registrados
        </div>
      ) : (
        <div className="space-y-6">
          {countries.map((country) => (
            <div key={country}>
              {/* Country header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="font-medium text-foreground">{getCountryName(country)}</span>
                <Badge variant="secondary">{grouped[country].length}</Badge>
              </div>

              {/* Comerciales del país */}
              <div className="grid gap-2">
                {grouped[country].map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground truncate">
                          {c.name}
                        </span>
                        {c.status === 'inactive' && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate block">
                        {c.calendar_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={c.status === 'active' ? 'Desactivar' : 'Activar'}
                        onClick={() => handleToggle(c)}
                      >
                        {c.status === 'active' ? (
                          <UserCheck className="w-4 h-4 text-green-500" />
                        ) : (
                          <UserX className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar comercial' : 'Agregar comercial'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Nombre completo</Label>
                <Input
                  placeholder="Ej: María López"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="comercial@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  onBlur={handleEmailBlur}
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Calendar ID</Label>
                <Input
                  placeholder="comercial@gmail.com"
                  value={formData.calendar_id}
                  onChange={(e) => setFormData((p) => ({ ...p, calendar_id: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Normalmente es el mismo email. Es el calendario que compartió contigo.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>País</Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => setFormData((p) => ({ ...p, country: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COUNTRY_NAMES).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, status: v as 'active' | 'inactive' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Empresa (opcional)</Label>
                <Input
                  placeholder="Ej: Effi Systems"
                  value={formData.empresa ?? ''}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, empresa: e.target.value || null }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? 'Guardar cambios' : 'Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este comercial?</AlertDialogTitle>
            <AlertDialogDescription>
              Los bookings asignados a este comercial quedarán sin calendario vinculado.
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
