import { useState, useEffect } from 'react';
import { BookingConfig, BookingBulletPoint, FormField, TrackingPixel, createDefaultBooking } from '@/lib/types';
import { checkBookingIdUnique } from '@/lib/bookingService';
import { generateSlug } from '@/lib/bookingStore';
import {
  CommercialCalendar,
  fetchCommercialCalendars,
  groupByCountry,
  getCountryName,
} from '@/lib/commercialCalendarsService';
import {
  CommercialGroup,
  fetchGroups,
} from '@/lib/commercialGroupsService';
import { CRMPipeline, fetchPipelines, createPipeline, PIPELINE_COLORS } from '@/lib/crmPipelinesService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { FormFieldsEditor } from './FormFieldsEditor';
import { TrackingPixelsEditor } from './TrackingPixelsEditor';

interface BookingFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (booking: BookingConfig) => void;
  booking?: BookingConfig | null;
  mode: 'create' | 'edit';
}

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 9);

export function BookingFormModal({
  open,
  onClose,
  onSave,
  booking,
  mode,
}: BookingFormModalProps) {
  const [formData, setFormData] = useState<BookingConfig>(createDefaultBooking());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('identity');
  const [isValidating, setIsValidating] = useState(false);
  const [commercials, setCommercials] = useState<CommercialCalendar[]>([]);
  const [groups, setGroups] = useState<CommercialGroup[]>([]);
  const [pipelines, setPipelines] = useState<CRMPipeline[]>([]);
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineColor, setNewPipelineColor] = useState(PIPELINE_COLORS[0]);
  const [newPipelineLoading, setNewPipelineLoading] = useState(false);

  useEffect(() => {
    fetchCommercialCalendars(true).then(setCommercials).catch(() => {});
    fetchGroups().then(setGroups).catch(() => {});
    fetchPipelines().then(setPipelines).catch(() => {});
  }, []);

  useEffect(() => {
    if (booking && mode === 'edit') {
      setFormData(booking);
    } else {
      setFormData(createDefaultBooking());
    }
    setErrors({});
    setActiveTab('identity');
  }, [booking, mode, open]);

  const updateField = <K extends keyof BookingConfig>(field: K, value: BookingConfig[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleNameChange = (name: string) => {
    updateField('name', name);
    if (mode === 'create') {
      const slug = generateSlug(name);
      updateField('booking_id', slug);
    }
  };

  const addBulletPoint = (field: 'topics' | 'targetAudience' | 'notFor' | 'expectations') => {
    const newPoint: BookingBulletPoint = { id: generateId(), text: '' };
    updateField(field, [...formData[field], newPoint]);
  };

  const updateBulletPoint = (
    field: 'topics' | 'targetAudience' | 'notFor' | 'expectations',
    id: string,
    text: string
  ) => {
    updateField(
      field,
      formData[field].map((item) => (item.id === id ? { ...item, text } : item))
    );
  };

  const removeBulletPoint = (
    field: 'topics' | 'targetAudience' | 'notFor' | 'expectations',
    id: string
  ) => {
    updateField(
      field,
      formData[field].filter((item) => item.id !== id)
    );
  };

  const validate = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.booking_id.trim()) {
      newErrors.booking_id = 'El ID es requerido';
    } else if (mode === 'create') {
      const isUnique = await checkBookingIdUnique(formData.booking_id);
      if (!isUnique) {
        newErrors.booking_id = 'Este ID ya existe';
      }
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'El título es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    setNewPipelineLoading(true);
    try {
      const created = await createPipeline({ name: newPipelineName.trim(), color: newPipelineColor });
      const updated = await fetchPipelines();
      setPipelines(updated);
      updateField('crm_pipeline_id', created.id);
      setNewPipelineOpen(false);
    } catch {
      // error silencioso — el usuario puede reintentar
    } finally {
      setNewPipelineLoading(false);
    }
  };

  const handleSubmit = async () => {
    setIsValidating(true);
    const isValid = await validate();
    setIsValidating(false);
    
    if (isValid) {
      onSave(formData);
      onClose();
    }
  };

  const BulletPointEditor = ({
    field,
    label,
  }: {
    field: 'topics' | 'targetAudience' | 'notFor' | 'expectations';
    label: string;
  }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => addBulletPoint(field)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {formData[field].map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              value={item.text}
              onChange={(e) => updateBulletPoint(field, item.id, e.target.value)}
              placeholder="Escribe aquí..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeBulletPoint(field, item.id)}
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Crear nuevo link de booking' : 'Editar booking'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="identity">Identidad</TabsTrigger>
            <TabsTrigger value="content">Contenido</TabsTrigger>
            <TabsTrigger value="audience">Audiencia</TabsTrigger>
            <TabsTrigger value="form">Formulario</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
          </TabsList>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del booking *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: Consultoría de Ventas"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="booking_id">ID del booking (URL) *</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">/booking/</span>
                <Input
                  id="booking_id"
                  value={formData.booking_id}
                  onChange={(e) => updateField('booking_id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="ventas-colombia"
                  className={errors.booking_id ? 'border-destructive' : ''}
                  disabled={mode === 'edit'}
                />
              </div>
              {errors.booking_id && <p className="text-sm text-destructive">{errors.booking_id}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="area">Área</Label>
                <Input
                  id="area"
                  value={formData.area}
                  onChange={(e) => updateField('area', e.target.value)}
                  placeholder="Ventas, Soporte, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>País / Región</Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => updateField('country', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar país" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CO">🇨🇴 Colombia</SelectItem>
                    <SelectItem value="MX">🇲🇽 México</SelectItem>
                    <SelectItem value="GT">🇬🇹 Guatemala</SelectItem>
                    <SelectItem value="CR">🇨🇷 Costa Rica</SelectItem>
                    <SelectItem value="DO">🇩🇴 República Dominicana</SelectItem>
                    <SelectItem value="EC">🇪🇨 Ecuador</SelectItem>
                    <SelectItem value="PE">🇵🇪 Perú</SelectItem>
                    <SelectItem value="CL">🇨🇱 Chile</SelectItem>
                    <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                    <SelectItem value="LATAM">🌎 LATAM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (minutos)</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => updateField('duration', parseInt(e.target.value) || 30)}
                min={15}
                max={120}
                step={15}
              />
            </div>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título principal (H1) *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="¿Listo para transformar tu negocio?"
                className={errors.title ? 'border-destructive' : ''}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtítulo / Descripción</Label>
              <Textarea
                id="subtitle"
                value={formData.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                placeholder="Una breve descripción de la reunión..."
                rows={2}
              />
            </div>

            <BulletPointEditor field="topics" label="¿Qué se va a tratar en la reunión?" />
          </TabsContent>

          {/* Audience Tab */}
          <TabsContent value="audience" className="space-y-6 mt-4">
            <BulletPointEditor field="targetAudience" label="¿Para quién es esta reunión?" />
            <BulletPointEditor field="notFor" label="¿Para quién NO es?" />
            <BulletPointEditor field="expectations" label="¿Qué esperamos del usuario?" />
          </TabsContent>
          {/* Form Fields Tab */}
          <TabsContent value="form" className="mt-4">
            <FormFieldsEditor
              fields={formData.formFields}
              onChange={(fields: FormField[]) => updateField('formFields', fields)}
            />
          </TabsContent>

          {/* Tracking Pixels Tab */}
          <TabsContent value="tracking" className="mt-4">
            <TrackingPixelsEditor
              pixels={formData.trackingPixels || []}
              onChange={(pixels: TrackingPixel[]) => updateField('trackingPixels', pixels)}
            />
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4 mt-4">
            {/* Tipo de asignación */}
            <div className="space-y-2">
              <Label>Tipo de asignación</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateField('assignment_type', 'individual')}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    formData.assignment_type === 'individual'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <p className="text-sm font-medium">Comercial individual</p>
                  <p className="text-xs mt-0.5 opacity-75">Un agente fijo para este booking</p>
                </button>
                <button
                  type="button"
                  onClick={() => updateField('assignment_type', 'group')}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    formData.assignment_type === 'group'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <p className="text-sm font-medium">Grupo (round-robin)</p>
                  <p className="text-xs mt-0.5 opacity-75">Rota entre varios comerciales</p>
                </button>
              </div>
            </div>

            {/* Selector condicional */}
            {formData.assignment_type === 'individual' ? (
              <div className="space-y-2">
                <Label>Comercial asignado</Label>
                <Select
                  value={formData.gcal_calendar_id === 'primary' ? '' : formData.gcal_calendar_id}
                  onValueChange={(calId) => {
                    updateField('gcal_calendar_id', calId);
                    updateField('commercial_group_id', null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un comercial..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupByCountry(commercials)).sort().map(([country, list]) => (
                      <SelectGroup key={country}>
                        <SelectLabel>{getCountryName(country)}</SelectLabel>
                        {list.map((c) => (
                          <SelectItem key={c.id} value={c.calendar_id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Las citas siempre van al calendario de este comercial.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Grupo de comerciales</Label>
                <Select
                  value={formData.commercial_group_id ?? ''}
                  onValueChange={(groupId) => {
                    updateField('commercial_group_id', groupId);
                    updateField('gcal_calendar_id', 'primary');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un grupo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.filter((g) => g.active).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                        {g.description ? ` — ${g.description}` : ''}
                      </SelectItem>
                    ))}
                    {groups.length === 0 && (
                      <SelectItem value="__none__" disabled>
                        No hay grupos. Créalos en la sección Comerciales.
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  El sistema asignará el comercial con menos citas del día (round-robin).
                </p>
              </div>
            )}

            {/* Pipeline CRM */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pipeline CRM</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => { setNewPipelineName(''); setNewPipelineColor(PIPELINE_COLORS[0]); setNewPipelineOpen(true); }}
                >
                  <Plus className="w-3 h-3" />
                  Crear pipeline
                </Button>
              </div>
              <Select
                value={formData.crm_pipeline_id ?? '__none__'}
                onValueChange={(v) => updateField('crm_pipeline_id', v === '__none__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin pipeline asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin pipeline asignado</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los leads de este booking irán a este pipeline CRM.
              </p>
            </div>

            {/* Mini-dialog: crear pipeline rápido */}
            <Dialog open={newPipelineOpen} onOpenChange={setNewPipelineOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Nuevo pipeline</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Nombre</Label>
                    <Input
                      placeholder="ej: Leads Colombia"
                      value={newPipelineName}
                      onChange={(e) => setNewPipelineName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreatePipeline()}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {PIPELINE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewPipelineColor(c)}
                          className="w-7 h-7 rounded-full border-2 transition-all"
                          style={{
                            backgroundColor: c,
                            borderColor: newPipelineColor === c ? '#000' : 'transparent',
                            outline: newPipelineColor === c ? '2px solid white' : 'none',
                            outlineOffset: '-3px',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewPipelineOpen(false)} disabled={newPipelineLoading}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreatePipeline} disabled={newPipelineLoading || !newPipelineName.trim()}>
                    {newPipelineLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Crear
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-2">
              <Label htmlFor="meeting_link">Link de reunión (Zoom)</Label>
              <Input
                id="meeting_link"
                value={formData.meeting_link ?? ''}
                onChange={(e) => updateField('meeting_link', e.target.value || null)}
                placeholder="https://zoom.us/j/..."
              />
              <p className="text-xs text-muted-foreground">
                Si se deja vacío, se usará el link del comercial asignado.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="policyText">Texto de política de datos</Label>
              <Textarea
                id="policyText"
                value={formData.policyText}
                onChange={(e) => updateField('policyText', e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Aceptación obligatoria de política</Label>
                <p className="text-xs text-muted-foreground">
                  El usuario debe aceptar antes de agendar
                </p>
              </div>
              <Switch
                checked={formData.requirePolicyAcceptance}
                onCheckedChange={(checked) => updateField('requirePolicyAcceptance', checked)}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label>Estado del booking</Label>
                <p className="text-xs text-muted-foreground">
                  {formData.active ? 'Visible y activo' : 'Pausado y oculto'}
                </p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => updateField('active', checked)}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            {mode === 'create' ? 'Crear booking' : 'Guardar cambios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
