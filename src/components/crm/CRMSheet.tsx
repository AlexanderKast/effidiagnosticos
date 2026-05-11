import { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, Building2, Calendar, Clock, User } from 'lucide-react';
import {
  AppointmentCRM,
  CRMEstado,
  CRMTipoCliente,
  CRM_ESTADOS,
  CRM_TIPOS_CLIENTE,
  CRM_TIPOS_MARKETING,
  ESTADO_COLORS,
  extractPhone,
  formatDate,
  formatTime,
} from '@/lib/crmUtils';
import { updateAppointmentCRM } from '@/lib/crmService';

interface CRMSheetProps {
  appointment: AppointmentCRM | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (id: string, fields: Partial<AppointmentCRM>) => void;
}

export function CRMSheet({ appointment, open, onOpenChange, onUpdated }: CRMSheetProps) {
  const [saving, setSaving] = useState<string | null>(null);

  const save = useCallback(
    async (fields: Parameters<typeof updateAppointmentCRM>[1]) => {
      if (!appointment) return;
      const key = Object.keys(fields)[0];
      setSaving(key);
      try {
        await updateAppointmentCRM(appointment.id, fields);
        onUpdated(appointment.id, fields as Partial<AppointmentCRM>);
      } catch (err) {
        console.error('[CRMSheet] save error:', err);
      } finally {
        setSaving(null);
      }
    },
    [appointment, onUpdated]
  );

  if (!appointment) return null;

  const phone = extractPhone(appointment.form_data);
  const formEntries = Object.entries(appointment.form_data).filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim() !== ''
  );

  const estadoColor = appointment.crm_estado_cliente
    ? ESTADO_COLORS[appointment.crm_estado_cliente as CRMEstado] ?? 'bg-gray-100 text-gray-600'
    : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">{appointment.lead_name}</SheetTitle>
          {appointment.crm_estado_cliente && (
            <Badge className={`w-fit border ${estadoColor}`} variant="outline">
              {appointment.crm_estado_cliente}
            </Badge>
          )}
        </SheetHeader>

        {/* Info básica */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{formatDate(appointment.appointment_date)} — {formatTime(appointment.start_time)}</span>
          </div>
          {appointment.assigned_commercial_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{appointment.assigned_commercial_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <a href={`mailto:${appointment.lead_email}`} className="text-primary underline underline-offset-2">
              {appointment.lead_email}
            </a>
          </div>
          {phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={`tel:${phone}`} className="font-medium">{phone}</a>
            </div>
          )}
          {appointment.lead_company && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{appointment.lead_company}</span>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Form data completo */}
        {formEntries.length > 0 && (
          <>
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Datos del formulario
            </h4>
            <div className="space-y-2 mb-4">
              {formEntries.map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-muted-foreground">{key}: </span>
                  <span className="text-foreground">{String(value)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
          </>
        )}

        {/* Campos CRM editables */}
        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Datos CRM
        </h4>

        <div className="space-y-4">
          {/* Estado */}
          <div className="space-y-1.5">
            <Label className="text-sm">Estado del cliente</Label>
            <Select
              value={appointment.crm_estado_cliente ?? ''}
              onValueChange={(v) => save({ crm_estado_cliente: v as CRMEstado })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar estado..." />
              </SelectTrigger>
              <SelectContent>
                {CRM_ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Venta realizada */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="venta-sheet"
              checked={appointment.crm_venta_realizada}
              onCheckedChange={(checked) => save({ crm_venta_realizada: !!checked })}
            />
            <Label htmlFor="venta-sheet" className="cursor-pointer">Venta realizada</Label>
          </div>

          {/* Monto */}
          <div className="space-y-1.5">
            <Label className="text-sm">Monto de la venta (COP)</Label>
            <Input
              type="number"
              placeholder="0"
              defaultValue={appointment.crm_monto_venta ?? ''}
              onBlur={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                save({ crm_monto_venta: val });
              }}
            />
          </div>

          {/* Tipo de cliente */}
          <div className="space-y-1.5">
            <Label className="text-sm">Tipo de cliente</Label>
            <Select
              value={appointment.crm_tipo_cliente ?? ''}
              onValueChange={(v) => save({ crm_tipo_cliente: v as CRMTipoCliente })}
            >
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

          {/* Tipo de marketing */}
          <div className="space-y-1.5">
            <Label className="text-sm">Tipo de marketing</Label>
            <Select
              value={appointment.crm_tipo_marketing ?? ''}
              onValueChange={(v) => save({ crm_tipo_marketing: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar fuente..." />
              </SelectTrigger>
              <SelectContent>
                {CRM_TIPOS_MARKETING.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label className="text-sm">Observaciones</Label>
            <Textarea
              placeholder="Notas del seguimiento..."
              defaultValue={appointment.crm_observaciones ?? ''}
              rows={4}
              onBlur={(e) => save({ crm_observaciones: e.target.value || null })}
            />
          </div>
        </div>

        {saving && (
          <p className="text-xs text-muted-foreground mt-4 text-center animate-pulse">
            Guardando...
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
