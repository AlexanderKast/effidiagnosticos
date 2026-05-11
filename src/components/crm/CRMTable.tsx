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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AppointmentCRM,
  CRMEstado,
  CRM_ESTADOS,
  ESTADO_COLORS,
  extractPhone,
  formatDate,
  formatTime,
  formatCurrency,
} from '@/lib/crmUtils';
import { updateAppointmentCRM } from '@/lib/crmService';

interface CRMTableProps {
  appointments: AppointmentCRM[];
  onRowClick: (appointment: AppointmentCRM) => void;
  onUpdated: (id: string, fields: Partial<AppointmentCRM>) => void;
}

export function CRMTable({ appointments, onRowClick, onUpdated }: CRMTableProps) {
  if (appointments.length === 0) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-muted-foreground">No hay registros para mostrar</p>
      </div>
    );
  }

  const handleEstadoChange = async (id: string, estado: CRMEstado) => {
    try {
      await updateAppointmentCRM(id, { crm_estado_cliente: estado });
      onUpdated(id, { crm_estado_cliente: estado });
    } catch (err) {
      console.error('[CRMTable] estado change error:', err);
    }
  };

  const handleVentaChange = async (id: string, checked: boolean) => {
    try {
      await updateAppointmentCRM(id, { crm_venta_realizada: checked });
      onUpdated(id, { crm_venta_realizada: checked });
    } catch (err) {
      console.error('[CRMTable] venta change error:', err);
    }
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="whitespace-nowrap">Registro</TableHead>
              <TableHead className="whitespace-nowrap">Fecha cita</TableHead>
              <TableHead className="whitespace-nowrap">Comercial</TableHead>
              <TableHead className="whitespace-nowrap">Cliente</TableHead>
              <TableHead className="whitespace-nowrap">Teléfono</TableHead>
              <TableHead className="whitespace-nowrap text-center">Venta</TableHead>
              <TableHead className="whitespace-nowrap">Tipo Marketing</TableHead>
              <TableHead className="whitespace-nowrap">Tipo Cliente</TableHead>
              <TableHead className="whitespace-nowrap">Monto</TableHead>
              <TableHead className="whitespace-nowrap min-w-[180px]">Estado</TableHead>
              <TableHead className="whitespace-nowrap min-w-[200px]">Observaciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appt) => {
              const phone = extractPhone(appt.form_data);
              const estadoColor = appt.crm_estado_cliente
                ? ESTADO_COLORS[appt.crm_estado_cliente as CRMEstado] ?? ''
                : '';

              return (
                <TableRow
                  key={appt.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => onRowClick(appt)}
                >
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(appt.created_at.slice(0, 10))}
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-sm">
                    <div>{formatDate(appt.appointment_date)}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(appt.start_time)}</div>
                  </TableCell>

                  <TableCell className="text-sm">
                    {appt.assigned_commercial_name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-sm">
                    <div className="font-medium">{appt.lead_name}</div>
                    <div className="text-xs text-muted-foreground">{appt.lead_email}</div>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {phone ?? '—'}
                  </TableCell>

                  <TableCell
                    className="text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={appt.crm_venta_realizada}
                      onCheckedChange={(c) => handleVentaChange(appt.id, !!c)}
                    />
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {appt.crm_tipo_marketing ?? '—'}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {appt.crm_tipo_cliente ?? '—'}
                  </TableCell>

                  <TableCell className="text-sm whitespace-nowrap">
                    {appt.crm_monto_venta ? formatCurrency(appt.crm_monto_venta) : '—'}
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={appt.crm_estado_cliente ?? ''}
                      onValueChange={(v) => handleEstadoChange(appt.id, v as CRMEstado)}
                    >
                      <SelectTrigger
                        className={cn(
                          'h-8 text-xs border',
                          appt.crm_estado_cliente ? estadoColor : 'text-muted-foreground'
                        )}
                      >
                        <SelectValue placeholder="Sin estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {CRM_ESTADOS.map((e) => (
                          <SelectItem key={e} value={e} className="text-xs">
                            {e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                    {appt.crm_observaciones ? (
                      <span className="line-clamp-2">{appt.crm_observaciones}</span>
                    ) : (
                      <span className="italic text-xs">Sin notas</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
