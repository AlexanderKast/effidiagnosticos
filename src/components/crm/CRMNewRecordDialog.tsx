import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { supabase } from '@/integrations/supabase/client';
import { CommercialOption } from '@/lib/crmService';
import { CommercialProfile } from '@/hooks/useAuth';
import { BookingConfig } from '@/lib/types';
import { CRMPipeline } from '@/lib/crmPipelinesService';
import { toast } from 'sonner';
import {
  CRM_ESTADOS,
  CRM_CANALES,
  CRM_TIPOS_CLIENTE,
  CANAL_ICONS,
  CRMEstado,
  CRMCanalOrigen,
  CRMTipoCliente,
  AppointmentCRM,
} from '@/lib/crmUtils';

interface CRMNewRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  bookings: BookingConfig[];
  pipelines: CRMPipeline[];
  selectedPipelineId: string | null;
  bookingCountry?: string;
  commercials: CommercialOption[];
  canReassign?: boolean;
  selfCommercial?: CommercialProfile | null;
  onCreated: (appointment: AppointmentCRM) => void;
}

const EMPTY = {
  lead_name: '',
  phone: '',
  commercial_id: '',
  selected_booking_id: '',
  selected_pipeline_id: '',
  crm_canal_origen: '' as CRMCanalOrigen | '',
  crm_tipo_cliente: '' as CRMTipoCliente | '',
  crm_estado_cliente: '' as CRMEstado | '',
};

export function CRMNewRecordDialog({
  open,
  onOpenChange,
  bookingId,
  bookings,
  pipelines,
  selectedPipelineId,
  bookingCountry = 'CO',
  commercials,
  canReassign = true,
  selfCommercial = null,
  onCreated,
}: CRMNewRecordDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ...EMPTY,
    selected_booking_id: bookingId ?? '',
    selected_pipeline_id: selectedPipelineId && selectedPipelineId !== '__none__' ? selectedPipelineId : '',
  });
  const [nameError, setNameError] = useState('');

  const set = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'lead_name') setNameError('');
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setForm({
        ...EMPTY,
        selected_booking_id: bookingId ?? '',
        selected_pipeline_id: selectedPipelineId && selectedPipelineId !== '__none__' ? selectedPipelineId : '',
      });
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!form.lead_name.trim()) {
      setNameError('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      // Auto-asignar al comercial actual si no puede reasignar
      let selectedCommercial: { id: string; name: string } | null = null;
      if (canReassign) {
        selectedCommercial = commercials.find((c) => c.id === form.commercial_id) ?? null;
      } else if (selfCommercial) {
        selectedCommercial = selfCommercial;
      }
      const finalBookingId = form.selected_booking_id || null;
      const finalPipelineId = form.selected_pipeline_id || null;

      // Si no se seleccionó pipeline manualmente, heredarlo del booking seleccionado
      let resolvedPipelineId = finalPipelineId;
      if (!resolvedPipelineId && finalBookingId) {
        const booking = bookings.find((b) => b.booking_id === finalBookingId);
        resolvedPipelineId = booking?.crm_pipeline_id ?? null;
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          booking_id: finalBookingId,
          crm_pipeline_id: resolvedPipelineId,
          lead_name: form.lead_name.trim(),
          lead_email: 'sin-email@manual.com',
          form_data: form.phone.trim() ? { telefono: form.phone.trim() } : {},
          appointment_date: new Date().toISOString().slice(0, 10),
          start_time: '09:00',
          end_time: '09:30',
          duration_minutes: 30,
          timezone: 'America/Bogota',
          status: 'confirmed',
          gcal_sync_status: 'skipped',
          source: 'admin',
          assigned_commercial_id: selectedCommercial?.id ?? null,
          assigned_commercial_name: selectedCommercial?.name ?? null,
          crm_canal_origen: form.crm_canal_origen || null,
          crm_tipo_cliente: form.crm_tipo_cliente || null,
          crm_estado_cliente: form.crm_estado_cliente || null,
        })
        .select()
        .single();

      if (error) throw error;

      onCreated(data as AppointmentCRM);
      onOpenChange(false);
      setNameError('');
    } catch (err) {
      console.error('[CRMNewRecordDialog] error:', err);
      const msg = err instanceof Error ? err.message : 'Error desconocido al crear el registro.';
      toast.error(`Error al crear registro: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo registro</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label>Nombre <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Nombre completo del cliente"
              value={form.lead_name}
              onChange={(e) => set('lead_name', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          {/* Teléfono */}
          <div className="space-y-1.5">
            <Label>Número de WhatsApp</Label>
            <PhoneInput
              value={form.phone}
              onChange={(v) => set('phone', v)}
              defaultCountry={bookingCountry}
            />
          </div>

          {/* Pipeline */}
          <div className="space-y-1.5">
            <Label>Pipeline CRM <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Select
              value={form.selected_pipeline_id || '__none__'}
              onValueChange={(v) => set('selected_pipeline_id', v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin pipeline</SelectItem>
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
          </div>

          {/* Booking (opcional) */}
          <div className="space-y-1.5">
            <Label>Booking asociado <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Select
              value={form.selected_booking_id || '__none__'}
              onValueChange={(v) => set('selected_booking_id', v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin booking asignado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin booking asignado</SelectItem>
                {bookings.map((b) => (
                  <SelectItem key={b.booking_id} value={b.booking_id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comercial: solo visible si puede reasignar */}
          {canReassign && commercials.length > 0 && (
            <div className="space-y-1.5">
              <Label>Comercial</Label>
              <Select value={form.commercial_id} onValueChange={(v) => set('commercial_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar comercial..." />
                </SelectTrigger>
                <SelectContent>
                  {commercials.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {/* Comercial auto-asignado (no editable) */}
          {!canReassign && selfCommercial && (
            <div className="space-y-1.5">
              <Label>Comercial asignado</Label>
              <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                {selfCommercial.name}
              </p>
            </div>
          )}

          {/* Canal */}
          <div className="space-y-1.5">
            <Label>Canal de origen</Label>
            <Select value={form.crm_canal_origen} onValueChange={(v) => set('crm_canal_origen', v)}>
              <SelectTrigger>
                <SelectValue placeholder="¿Por dónde llegó?" />
              </SelectTrigger>
              <SelectContent>
                {CRM_CANALES.map((c) => (
                  <SelectItem key={c} value={c}>{CANAL_ICONS[c]} {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de cliente */}
          <div className="space-y-1.5">
            <Label>Tipo de cliente</Label>
            <Select value={form.crm_tipo_cliente} onValueChange={(v) => set('crm_tipo_cliente', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {CRM_TIPOS_CLIENTE.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={form.crm_estado_cliente} onValueChange={(v) => set('crm_estado_cliente', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Estado del lead..." />
              </SelectTrigger>
              <SelectContent>
                {CRM_ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
