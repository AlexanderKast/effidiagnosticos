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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { CommercialGroupsManager } from './CommercialGroupsManager';

const EMPTY_FORM: CommercialCalendarInput = {
  commercial_id: null,
  name: '',
  email: '',
  calendar_id: '',
  status: 'active',
  empresa: null,
  country: 'CO',
};

function CommercialCard({
  c,
  onEdit,
  onToggle,
  onDelete,
}: {
  c: CommercialCalendar;
  onEdit: (c: CommercialCalendar) => void;
  onToggle: (c: CommercialCalendar) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-foreground truncate">{c.name}</span>
          {c.status === 'inactive' && (
            <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
              Inactivo
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground truncate block">{c.calendar_id}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={c.status === 'active' ? 'Desactivar' : 'Activar'}
          onClick={() => onToggle(c)}
        >
          {c.status === 'active' ? (
            <UserCheck className="w-4 h-4 text-green-500" />
          ) : (
            <UserX className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(c.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Equipo Comercial</h2>
        <p className="text-sm text-muted-foreground">
          Gestiona los comerciales y grupos para asignación de bookings
        </p>
      </div>

      <Tabs defaultValue="comerciales" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="comerciales">Comerciales</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
        </TabsList>

        {/* Tab: Comerciales */}
        <TabsContent value="comerciales" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {commercials.length} registrados · {activeCount} activos · {countries.length}{' '}
              {countries.length === 1 ? 'país' : 'países'}
            </p>
            <Button onClick={openCreate} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Agregar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : commercials.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No hay comerciales registrados
            </div>
          ) : (
            <Tabs defaultValue={countries[0]} className="w-full">
              {/* Tabs de países */}
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted p-1 mb-2">
                <TabsTrigger value="__all__" className="text-xs gap-1.5">
                  Todos
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                    {commercials.length}
                  </Badge>
                </TabsTrigger>
                {countries.map((country) => (
                  <TabsTrigger key={country} value={country} className="text-xs gap-1.5">
                    {getCountryName(country)}
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
                      {grouped[country].length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Tab: Todos */}
              <TabsContent value="__all__" className="space-y-4 mt-0">
                {countries.map((country) => (
                  <div key={country} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                      {getCountryName(country)}
                    </p>
                    <div className="space-y-1.5">
                      {grouped[country].map((c) => (
                        <CommercialCard
                          key={c.id}
                          c={c}
                          onEdit={openEdit}
                          onToggle={handleToggle}
                          onDelete={setDeleteId}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </TabsContent>

              {/* Tab por país */}
              {countries.map((country) => (
                <TabsContent key={country} value={country} className="space-y-1.5 mt-0">
                  {grouped[country].map((c) => (
                    <CommercialCard
                      key={c.id}
                      c={c}
                      onEdit={openEdit}
                      onToggle={handleToggle}
                      onDelete={setDeleteId}
                    />
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>

        {/* Tab: Grupos */}
        <TabsContent value="grupos" className="mt-4">
          <CommercialGroupsManager />
        </TabsContent>
      </Tabs>

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar comercial' : 'Agregar comercial'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input
                placeholder="Ej: María López"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="comercial@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                onBlur={handleEmailBlur}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Calendar ID</Label>
              <Input
                placeholder="comercial@gmail.com"
                value={formData.calendar_id}
                onChange={(e) => setFormData((p) => ({ ...p, calendar_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Normalmente es el mismo email del comercial.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="space-y-1.5">
              <Label>Empresa (opcional)</Label>
              <Input
                placeholder="Ej: Effi Systems"
                value={formData.empresa ?? ''}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, empresa: e.target.value || null }))
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
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
              Los bookings asignados quedarán sin calendario vinculado.
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
