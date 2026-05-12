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
  bookingId: string;
  bookingCountry?: string;
  commercials: CommercialOption[];
  onCreated: (appointment: AppointmentCRM) => void;
}

const EMPTY = {
  lead_name: '',
  phone: '',
  appointment_date: new Date().toISOString().slice(0, 10),
  commercial_id: '',
  crm_canal_origen: '' as CRMCanalOrigen | '',
  crm_tipo_cliente: '' as CRMTipoCliente | '',
  crm_estado_cliente: '' as CRMEstado | '',
};

export function CRMNewRecordDialog({
  open,
  onOpenChange,
  bookingId,
  bookingCountry = 'CO',
  commercials,
  onCreated,
}: CRMNewRecordDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [nameError, setNameError] = useState('');

  const set = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'lead_name') setNameError('');
  };

  const handleSubmit = async () => {
    if (!form.lead_name.trim()) {
      setNameError('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      const selectedCommercial = commercials.find((c) => c.id === form.commercial_id) ?? null;

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          booking_id: bookingId,
          lead_name: form.lead_name.trim(),
          lead_email: 'sin-email@manual.com',
          form_data: form.phone.trim() ? { telefono: form.phone.trim() } : {},
          appointment_date: form.appointment_date,
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
      setForm(EMPTY);
      setNameError('');
    } catch (err) {
      console.error('[CRMNewRecordDialog] error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={form.appointment_date}
              onChange={(e) => set('appointment_date', e.target.value)}
            />
          </div>

          {/* Comercial */}
          {commercials.length > 0 && (
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
