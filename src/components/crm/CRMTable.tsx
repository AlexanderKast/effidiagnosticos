import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getWhatsAppLink } from '@/components/ui/PhoneInput';
import {
  AppointmentCRM,
  CRMEstado,
  CRMCanalOrigen,
  CRMTipoCliente,
  CRM_ESTADOS,
  CRM_CANALES,
  CRM_TIPOS_CLIENTE,
  CRM_TIPOS_MARKETING,
  ESTADO_COLORS,
  CANAL_ICONS,
  DuplicatesMap,
  extractPhone,
  formatDate,
  formatTime,
  getCurrencyForCountry,
} from '@/lib/crmUtils';
import { updateAppointmentCRM, CommercialOption } from '@/lib/crmService';

interface CRMTableProps {
  appointments: AppointmentCRM[];
  commercials: CommercialOption[];
  duplicatesMap?: DuplicatesMap;
  onRowClick: (appointment: AppointmentCRM) => void;
  onUpdated: (id: string, fields: Partial<AppointmentCRM>) => void;
}

// ── Color consistente por nombre de comercial ──────────────────────────────
const COMMERCIAL_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1',
  '#14b8a6', '#ef4444',
];

function getCommercialColor(name: string | null | undefined): string {
  if (!name) return 'transparent';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return COMMERCIAL_COLORS[Math.abs(hash) % COMMERCIAL_COLORS.length];
}

// ── Celda editable inline (stopPropagation para no abrir sheet) ─────────────
function StopCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableCell className={className} onClick={(e) => e.stopPropagation()}>
      {children}
    </TableCell>
  );
}

export function CRMTable({ appointments, commercials, duplicatesMap = {}, onRowClick, onUpdated }: CRMTableProps) {
  if (appointments.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-muted-foreground">No hay registros para mostrar</p>
      </div>
    );
  }

  const save = async (id: string, fields: Partial<AppointmentCRM>) => {
    try {
      await updateAppointmentCRM(id, fields);
      onUpdated(id, fields);
    } catch (err) {
      console.error('[CRMTable] save error:', err);
    }
  };

  const saveCommercial = (id: string, commercialId: string) => {
    const selected = commercials.find((c) => c.id === commercialId) ?? null;
    save(id, {
      assigned_commercial_id: selected?.id ?? null,
      assigned_commercial_name: selected?.name ?? null,
    } as Partial<AppointmentCRM>);
  };

  const CommercialSelect = ({ appt, className }: { appt: AppointmentCRM; className?: string }) => (
    <Select
      value={appt.assigned_commercial_id ?? ''}
      onValueChange={(v) => saveCommercial(appt.id, v)}
    >
      <SelectTrigger className={cn('h-7 text-xs border-transparent hover:border-border', className)}>
        <SelectValue placeholder="Sin asignar" />
      </SelectTrigger>
      <SelectContent>
        {commercials.map((c) => (
          <SelectItem key={c.id} value={c.id} className="text-xs">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // ── Mobile cards ───────────────────────────────────────────────────────────
  const MobileCards = () => (
    <div className="flex flex-col gap-3 md:hidden">
      {appointments.map((appt) => {
        const phone = extractPhone(appt.form_data);
        const color = getCommercialColor(appt.assigned_commercial_name);
        const estadoColor = appt.crm_estado_cliente
          ? ESTADO_COLORS[appt.crm_estado_cliente as CRMEstado] ?? ''
          : '';
        const email = appt.lead_email?.trim().toLowerCase();
        const isDuplicate = email ? (duplicatesMap[email]?.length ?? 0) > 1 : false;

        return (
          <div
            key={appt.id}
            className="bg-card border border-border rounded-xl p-4 cursor-pointer active:bg-muted/30 transition-colors"
            style={{ borderLeft: `4px solid ${color}` }}
            onClick={() => onRowClick(appt)}
          >
            {/* Nombre + estado */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-foreground truncate">{appt.lead_name}</p>
                  {isDuplicate && (
                    <span className="shrink-0 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                      2x
                    </span>
                  )}
                </div>
                {phone && getWhatsAppLink(phone)
                  ? <a href={getWhatsAppLink(phone)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-sm text-green-600 hover:underline">{phone}</a>
                  : phone && <p className="text-sm text-muted-foreground">{phone}</p>
                }
              </div>
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <Select
                  value={appt.crm_estado_cliente ?? ''}
                  onValueChange={(v) => save(appt.id, { crm_estado_cliente: v as CRMEstado })}
                >
                  <SelectTrigger className={cn('h-7 text-xs border w-[140px]', appt.crm_estado_cliente ? estadoColor : 'text-muted-foreground')}>
                    <SelectValue placeholder="Sin estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_ESTADOS.map((e) => (
                      <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fechas + comercial + canal */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
              <span>📅 {formatDate(appt.appointment_date)} {formatTime(appt.start_time)}</span>
              <span>🕐 {formatDate(appt.created_at.slice(0, 10))}</span>
              {appt.assigned_commercial_name && <span>👤 {appt.assigned_commercial_name}</span>}

              {appt.crm_canal_origen && (
                <span>{CANAL_ICONS[appt.crm_canal_origen as CRMCanalOrigen]} {appt.crm_canal_origen}</span>
              )}
            </div>

            {/* Edición inline en card */}
            <div className="grid grid-cols-2 gap-2 mb-2" onClick={(e) => e.stopPropagation()}>
              {/* Comercial */}
              <CommercialSelect appt={appt} className="col-span-2 border-border/50" />
            </div>
            <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
              {/* Canal */}
              <Select
                value={appt.crm_canal_origen ?? ''}
                onValueChange={(v) => save(appt.id, { crm_canal_origen: v as CRMCanalOrigen })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Canal..." />
                </SelectTrigger>
                <SelectContent>
                  {CRM_CANALES.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{CANAL_ICONS[c]} {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Monto */}
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                  {getCurrencyForCountry(appt.booking_country).currency}
                </span>
                <Input
                  type="number"
                  placeholder="Monto..."
                  className="h-7 text-xs pl-11"
                  defaultValue={appt.crm_monto_venta ?? ''}
                  onBlur={(e) => save(appt.id, { crm_monto_venta: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            {/* Venta + observaciones */}
            <div className="flex items-center gap-3 mt-2" onClick={(e) => e.stopPropagation()}>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer shrink-0">
                <Checkbox
                  checked={appt.crm_venta_realizada}
                  onCheckedChange={(c) => save(appt.id, { crm_venta_realizada: !!c })}
                />
                <span className="text-muted-foreground">Venta</span>
              </label>
              <Input
                placeholder="Observaciones..."
                className="h-7 text-xs flex-1"
                defaultValue={appt.crm_observaciones ?? ''}
                onBlur={(e) => save(appt.id, { crm_observaciones: e.target.value || null })}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── Desktop table ──────────────────────────────────────────────────────────
  return (
    <>
      <MobileCards />

      <div className="hidden md:block rounded-xl border border-border overflow-hidden bg-card w-full">
        <div className="overflow-x-auto w-full">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="whitespace-nowrap sticky left-0 bg-muted/50 z-10 pl-5">Cliente</TableHead>
                <TableHead className="whitespace-nowrap">Teléfono</TableHead>
                <TableHead className="whitespace-nowrap">Registro</TableHead>
                <TableHead className="whitespace-nowrap">Fecha cita</TableHead>
                <TableHead className="whitespace-nowrap">Comercial</TableHead>
                <TableHead className="whitespace-nowrap text-center">Venta</TableHead>
                <TableHead className="whitespace-nowrap min-w-[140px]">Canal</TableHead>
                <TableHead className="whitespace-nowrap min-w-[150px] hidden xl:table-cell">Tipo Marketing</TableHead>
                <TableHead className="whitespace-nowrap min-w-[150px] hidden xl:table-cell">Tipo Cliente</TableHead>
                <TableHead className="whitespace-nowrap min-w-[130px]">Monto (COP)</TableHead>
                <TableHead className="whitespace-nowrap min-w-[180px]">Estado</TableHead>
                <TableHead className="whitespace-nowrap min-w-[220px]">Observaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appt) => {
                const phone = extractPhone(appt.form_data);
                const color = getCommercialColor(appt.assigned_commercial_name);
                const estadoColor = appt.crm_estado_cliente
                  ? ESTADO_COLORS[appt.crm_estado_cliente as CRMEstado] ?? ''
                  : '';
                const email = appt.lead_email?.trim().toLowerCase();
                const isDuplicate = email ? (duplicatesMap[email]?.length ?? 0) > 1 : false;

                return (
                  <TableRow
                    key={appt.id}
                    className="cursor-pointer hover:brightness-95 transition-all"
                    style={{ borderLeft: `4px solid ${color}` }}
                    onClick={() => onRowClick(appt)}
                  >
                    {/* Cliente — sticky, click abre sheet */}
                    <TableCell className="sticky left-0 bg-card z-10 text-sm pl-3" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
                      <div className="flex items-center gap-1.5 font-medium whitespace-nowrap">
                        {appt.lead_name}
                        {isDuplicate && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                            dup
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{appt.lead_email}</div>
                    </TableCell>

                    {/* Teléfono — WhatsApp link */}
                    <TableCell className="text-sm whitespace-nowrap">
                      {phone
                        ? getWhatsAppLink(phone)
                          ? <a href={getWhatsAppLink(phone)!} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-medium">{phone}</a>
                          : <span className="text-muted-foreground">{phone}</span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>

                    {/* Registro — solo lectura */}
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(appt.created_at.slice(0, 10))}
                    </TableCell>

                    {/* Fecha cita — solo lectura */}
                    <TableCell className="whitespace-nowrap text-sm">
                      <div>{formatDate(appt.appointment_date)}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(appt.start_time)}</div>
                    </TableCell>

                    {/* Comercial — select inline */}
                    <StopCell className="min-w-[150px]">
                      <CommercialSelect appt={appt} />
                    </StopCell>

                    {/* Venta — checkbox inline */}
                    <StopCell className="text-center">
                      <Checkbox
                        checked={appt.crm_venta_realizada}
                        onCheckedChange={(c) => save(appt.id, { crm_venta_realizada: !!c })}
                      />
                    </StopCell>

                    {/* Canal — select inline */}
                    <StopCell>
                      <Select
                        value={appt.crm_canal_origen ?? ''}
                        onValueChange={(v) => save(appt.id, { crm_canal_origen: v as CRMCanalOrigen })}
                      >
                        <SelectTrigger className="h-7 text-xs border-transparent hover:border-border">
                          <SelectValue placeholder="Canal..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_CANALES.map((c) => (
                            <SelectItem key={c} value={c} className="text-xs">
                              {CANAL_ICONS[c]} {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </StopCell>

                    {/* Tipo Marketing — select inline (xl) */}
                    <StopCell className="hidden xl:table-cell">
                      <Select
                        value={appt.crm_tipo_marketing ?? ''}
                        onValueChange={(v) => save(appt.id, { crm_tipo_marketing: v })}
                      >
                        <SelectTrigger className="h-7 text-xs border-transparent hover:border-border">
                          <SelectValue placeholder="Marketing..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_TIPOS_MARKETING.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </StopCell>

                    {/* Tipo Cliente — select inline (xl) */}
                    <StopCell className="hidden xl:table-cell">
                      <Select
                        value={appt.crm_tipo_cliente ?? ''}
                        onValueChange={(v) => save(appt.id, { crm_tipo_cliente: v as CRMTipoCliente })}
                      >
                        <SelectTrigger className="h-7 text-xs border-transparent hover:border-border">
                          <SelectValue placeholder="Tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_TIPOS_CLIENTE.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </StopCell>

                    {/* Monto — input inline */}
                    <StopCell>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                          {getCurrencyForCountry(appt.booking_country).currency}
                        </span>
                        <Input
                          type="number"
                          placeholder="0"
                          className="h-7 text-xs min-w-[100px] pl-11 border-transparent hover:border-border focus:border-border bg-transparent"
                          defaultValue={appt.crm_monto_venta ?? ''}
                          onBlur={(e) => save(appt.id, { crm_monto_venta: e.target.value ? Number(e.target.value) : null })}
                        />
                      </div>
                    </StopCell>

                    {/* Estado — select inline */}
                    <StopCell>
                      <Select
                        value={appt.crm_estado_cliente ?? ''}
                        onValueChange={(v) => save(appt.id, { crm_estado_cliente: v as CRMEstado })}
                      >
                        <SelectTrigger className={cn('h-8 text-xs border', appt.crm_estado_cliente ? estadoColor : 'text-muted-foreground border-transparent hover:border-border')}>
                          <SelectValue placeholder="Sin estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRM_ESTADOS.map((e) => (
                            <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </StopCell>

                    {/* Observaciones — input inline */}
                    <StopCell>
                      <Input
                        placeholder="Sin notas..."
                        className="h-7 text-xs border-transparent hover:border-border focus:border-border bg-transparent"
                        defaultValue={appt.crm_observaciones ?? ''}
                        onBlur={(e) => save(appt.id, { crm_observaciones: e.target.value || null })}
                      />
                    </StopCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
