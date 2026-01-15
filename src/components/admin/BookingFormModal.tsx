import { useState, useEffect } from 'react';
import { BookingConfig, BookingBulletPoint, createDefaultBooking } from '@/lib/types';
import { checkBookingIdUnique } from '@/lib/bookingService';
import { generateSlug } from '@/lib/bookingStore';
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
import { Plus, Trash2 } from 'lucide-react';

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
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="identity">Identidad</TabsTrigger>
            <TabsTrigger value="content">Contenido</TabsTrigger>
            <TabsTrigger value="audience">Audiencia</TabsTrigger>
            <TabsTrigger value="config">Configuración</TabsTrigger>
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
                <Label htmlFor="country">País / Región</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  placeholder="Colombia, LATAM, etc."
                />
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

          {/* Config Tab */}
          <TabsContent value="config" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="n8n_availability">URL n8n - Disponibilidad</Label>
              <Input
                id="n8n_availability"
                value={formData.n8n_get_availability_url}
                onChange={(e) => updateField('n8n_get_availability_url', e.target.value)}
                placeholder="https://tu-n8n.com/webhook/disponibilidad"
              />
              <p className="text-xs text-muted-foreground">
                Webhook para obtener horarios disponibles
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="n8n_booking">URL n8n - Crear reserva</Label>
              <Input
                id="n8n_booking"
                value={formData.n8n_create_booking_url}
                onChange={(e) => updateField('n8n_create_booking_url', e.target.value)}
                placeholder="https://tu-n8n.com/webhook/reserva"
              />
              <p className="text-xs text-muted-foreground">
                Webhook para confirmar la cita
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
