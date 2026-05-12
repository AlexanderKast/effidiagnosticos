import { useState, useCallback, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Phone, Mail, Building2, Calendar, User, UserPlus, Pencil, X, Save, Loader2, Archive, ArchiveRestore, CalendarPlus, ExternalLink } from 'lucide-react';
import { PhoneInput, getWhatsAppLink } from '@/components/ui/PhoneInput';
import {
  AppointmentCRM,
  CRMEstado,
  CRMTipoCliente,
  CRMCanalOrigen,
  CRM_ESTADOS,
  CRM_TIPOS_CLIENTE,
  CRM_TIPOS_MARKETING,
  CRM_CANALES,
  CANAL_ICONS,
  ESTADO_COLORS,
  extractPhone,
  formatDate,
  formatTime,
} from '@/lib/crmUtils';
import { updateAppointmentCRM, updateAppointmentLead, archiveAppointment, CommercialOption } from '@/lib/crmService';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CRMSheetProps {
  appointment: AppointmentCRM | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (id: string, fields: Partial<AppointmentCRM>) => void;
  onArchived: (id: string) => void;
  commercials: CommercialOption[];
  canReassign?: boolean;
}

export function CRMSheet({ appointment, open, onOpenChange, onUpdated, onArchived, commercials, canReassign = false }: CRMSheetProps) {
  const [saving, setSaving] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [creatingGcal, setCreatingGcal] = useState(false);
  const [gcalLink, setGcalLink] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    lead_name: '',
    lead_email: '',
    lead_company: '',
    appointment_date: '',
    start_time: '',
    phone: '',
    commercial_id: '',
  });

  useEffect(() => {
    if (appointment && isEditing) {
      setEditForm({
        lead_name: appointment.lead_name ?? '',
        lead_email: appointment.lead_email ?? '',
        lead_company: appointment.lead_company ?? '',
        appointment_date: appointment.appointment_date ?? '',
        start_time: appointment.start_time?.slice(0, 5) ?? '',
        phone: extractPhone(appointment.form_data) ?? '',
        commercial_id: appointment.assigned_commercial_id ?? '',
      });
    }
  }, [appointment, isEditing]);

  const save = useCallback(
    async (fields: Parameters<typeof updateAppointmentCRM>[1]) => {
      if (!appointment) return;
      const key = Object.keys(fields)[0];
      setSaving(key);
      try {
        await updateAppointmentCRM(appointment.id, fields, canReassign);
        onUpdated(appointment.id, fields as Partial<AppointmentCRM>);
      } catch (err) {
        console.error('[CRMSheet] save error:', err);
        toast.error(err instanceof Error ? err.message : 'Error al guardar. Intenta de nuevo.');
      } finally {
        setSaving(null);
      }
    },
    [appointment, onUpdated, canReassign]
  );

  useEffect(() => {
    setGcalLink(appointment?.gcal_html_link ?? null);
  }, [appointment?.id]);

  const handleCreateGcal = async () => {
    if (!appointment) return;
    setCreatingGcal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-gcal-for-appointment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ appointment_id: appointment.id }),
        }
      );
      const result = await resp.json();
      if (!resp.ok || !result.ok) {
        throw new Error(result.error || `Error del servidor: ${resp.status}`);
      }
      setGcalLink(result.gcal_html_link);
      onUpdated(appointment.id, {
        gcal_event_id: result.gcal_event_id,
        gcal_html_link: result.gcal_html_link,
      } as Partial<AppointmentCRM>);
      toast.success('Evento creado en Google Calendar.');
    } catch (err) {
      console.error('[CRMSheet] createGcal error:', err);
      toast.error('Error al crear el evento de Google Calendar.');
    } finally {
      setCreatingGcal(false);
    }
  };

  const handleArchive = async () => {
    if (!appointment) return;
    setArchiving(true);
    try {
      const newArchived = !appointment.archived;
      await archiveAppointment(appointment.id, newArchived);
      onArchived(appointment.id);
      onOpenChange(false);
    } catch (err) {
      console.error('[CRMSheet] archive error:', err);
      toast.error(err instanceof Error ? err.message : 'Error al archivar.');
    } finally {
      setArchiving(false);
    }
  };

  const handleSaveLead = async () => {
    if (!appointment) return;
    setSavingLead(true);
    try {
      const selectedCommercial = canReassign
        ? (commercials.find((c) => c.id === editForm.commercial_id) ?? null)
        : null;
      const fields = {
        lead_name: editForm.lead_name.trim(),
        lead_email: editForm.lead_email.trim(),
        lead_company: editForm.lead_company.trim() || null,
        appointment_date: editForm.appointment_date,
        start_time: editForm.start_time,
        phone: editForm.phone.trim(),
        assigned_commercial_id: canReassign
          ? (selectedCommercial?.id ?? null)
          : (appointment.assigned_commercial_id ?? null),
        assigned_commercial_name: canReassign
          ? (selectedCommercial?.name ?? null)
          : (appointment.assigned_commercial_name ?? null),
      };
      await updateAppointmentLead(appointment.id, fields, appointment.form_data);
      onUpdated(appointment.id, {
        lead_name: fields.lead_name,
        lead_email: fields.lead_email,
        lead_company: fields.lead_company,
        appointment_date: fields.appointment_date,
        start_time: fields.start_time,
        assigned_commercial_id: fields.assigned_commercial_id,
        assigned_commercial_name: fields.assigned_commercial_name,
        form_data: {
          ...appointment.form_data,
          ['whatsapp' in appointment.form_data ? 'whatsapp' : 'telefono']: fields.phone,
        },
      });
      toast.success('Lead actualizado correctamente.');
      setIsEditing(false);
    } catch (err) {
      console.error('[CRMSheet] saveLead error:', err);
      toast.error(err instanceof Error ? err.message : 'Error al guardar el lead.');
    } finally {
      setSavingLead(false);
    }
  };

  if (!appointment) return null;

  const phone = extractPhone(appointment.form_data);
  const formEntries = Object.entries(appointment.form_data).filter(
    ([k, v]) =>
      v !== undefined && v !== null && String(v).trim() !== '' &&
      !['whatsapp', 'telefono', 'tel', 'phone'].includes(k.toLowerCase())
  );

  const estadoColor = appointment.crm_estado_cliente
    ? ESTADO_COLORS[appointment.crm_estado_cliente as CRMEstado] ?? 'bg-gray-100 text-gray-600'
    : '';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) setIsEditing(false); onOpenChange(o); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-left">{appointment.lead_name}</SheetTitle>
              {appointment.crm_estado_cliente && (
                <Badge className={`w-fit border mt-1 ${estadoColor}`} variant="outline">
                  {appointment.crm_estado_cliente}
                </Badge>
              )}
            </div>
            <Button
              variant={isEditing ? 'destructive' : 'outline'}
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? <><X className="w-3.5 h-3.5" /> Cancelar</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}
            </Button>
          </div>
        </SheetHeader>

        {/* ── MODO EDICIÓN ──────────────────────────────────────────── */}
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={editForm.lead_name}
                onChange={(e) => setEditForm((p) => ({ ...p, lead_name: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.lead_email}
                onChange={(e) => setEditForm((p) => ({ ...p, lead_email: e.target.value }))}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono / WhatsApp</Label>
              <PhoneInput
                value={editForm.phone}
                onChange={(v) => setEditForm((p) => ({ ...p, phone: v }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input
                value={editForm.lead_company}
                onChange={(e) => setEditForm((p) => ({ ...p, lead_company: e.target.value }))}
                placeholder="Nombre de la empresa"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha de cita</Label>
                <Input
                  type="date"
                  value={editForm.appointment_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, appointment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hora</Label>
                <Input
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm((p) => ({ ...p, start_time: e.target.value }))}
                />
              </div>
            </div>
            {canReassign && commercials.length > 0 && (
              <div className="space-y-1.5">
                <Label>Comercial asignado</Label>
                <Select
                  value={editForm.commercial_id}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, commercial_id: v }))}
                >
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
            <Button className="w-full gap-2" onClick={handleSaveLead} disabled={savingLead}>
              {savingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </Button>
          </div>
        ) : (
          <>
            {/* ── MODO VISTA ──────────────────────────────────────────── */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Registro: {formatDate(appointment.created_at.slice(0, 10))}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Cita: {formatDate(appointment.appointment_date)} — {formatTime(appointment.start_time)}</span>
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
                  {getWhatsAppLink(phone) ? (
                    <a href={getWhatsAppLink(phone)!} target="_blank" rel="noopener noreferrer" className="font-medium text-green-600 hover:underline">
                      {phone}
                    </a>
                  ) : (
                    <span className="font-medium">{phone}</span>
                  )}
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

            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Datos CRM
            </h4>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">¿Por dónde llegó el lead?</Label>
                <Select
                  value={appointment.crm_canal_origen ?? ''}
                  onValueChange={(v) => save({ crm_canal_origen: v as CRMCanalOrigen })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar canal..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_CANALES.map((c) => (
                      <SelectItem key={c} value={c}>{CANAL_ICONS[c]} {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <div className="flex items-center gap-3">
                <Checkbox
                  id="venta-sheet"
                  checked={appointment.crm_venta_realizada}
                  onCheckedChange={(checked) => save({ crm_venta_realizada: !!checked })}
                />
                <Label htmlFor="venta-sheet" className="cursor-pointer">Venta realizada</Label>
              </div>

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

            <Separator className="my-5" />

            {/* Google Calendar */}
            {gcalLink ? (
              <a href={gcalLink} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="outline" size="sm" className="w-full gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                  <ExternalLink className="w-4 h-4" />
                  Ver en Google Calendar
                </Button>
              </a>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleCreateGcal}
                disabled={creatingGcal}
              >
                {creatingGcal ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                Crear evento en Google Calendar
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 mt-2 text-muted-foreground hover:text-destructive hover:border-destructive"
              onClick={handleArchive}
              disabled={archiving}
            >
              {archiving
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : appointment.archived
                  ? <><ArchiveRestore className="w-4 h-4" /> Restaurar lead</>
                  : <><Archive className="w-4 h-4" /> Archivar lead</>
              }
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
