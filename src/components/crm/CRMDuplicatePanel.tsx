import { useState } from 'react';
import { Copy, Merge, AlertTriangle, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppointmentCRM, formatDate, ESTADO_COLORS } from '@/lib/crmUtils';
import { CommercialOption, mergeLeads } from '@/lib/crmService';
import { toast } from 'sonner';

interface CRMDuplicatePanelProps {
  current: AppointmentCRM;
  duplicates: AppointmentCRM[];
  commercials: CommercialOption[];
  canReassign: boolean;
  onMerged: (winnerId: string, archivedIds: string[]) => void;
}

export function CRMDuplicatePanel({
  current,
  duplicates,
  commercials,
  canReassign,
  onMerged,
}: CRMDuplicatePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [winnerId, setWinnerId] = useState<string>(current.id);
  const [assignComId, setAssignComId] = useState<string>('__keep__');
  const [isMerging, setIsMerging] = useState(false);

  const allGroup = [current, ...duplicates];

  const handleMerge = async () => {
    const winner = allGroup.find((a) => a.id === winnerId);
    if (!winner) return;
    const losers = allGroup.filter((a) => a.id !== winnerId);

    setIsMerging(true);
    try {
      const commercialId = assignComId === '__keep__' ? undefined : assignComId || null;
      const commercialName =
        commercialId === undefined
          ? undefined
          : commercials.find((c) => c.id === commercialId)?.name ?? null;

      const result = await mergeLeads(
        {
          winner,
          losers,
          assignCommercialId: commercialId,
          assignCommercialName: commercialName,
        },
        canReassign,
      );
      toast.success(`Lead fusionado. ${result.archivedIds.length} duplicado(s) archivado(s).`);
      onMerged(winner.id, result.archivedIds);
    } catch (err: any) {
      toast.error(err.message ?? 'Error al fusionar');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 text-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
      >
        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
        <span className="font-medium flex-1 text-left">
          {duplicates.length} lead{duplicates.length > 1 ? 's' : ''} duplicado{duplicates.length > 1 ? 's' : ''} detectado{duplicates.length > 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Lista del grupo */}
          <div className="space-y-1.5">
            {allGroup.map((appt) => (
              <div
                key={appt.id}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                  winnerId === appt.id
                    ? 'border-amber-400 bg-amber-100'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
                onClick={() => setWinnerId(appt.id)}
              >
                <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center border-amber-500">
                  {winnerId === appt.id && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{appt.lead_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {formatDate(appt.appointment_date)} · {appt.assigned_commercial_name ?? 'Sin comercial'}
                  </p>
                </div>
                {appt.crm_estado_cliente && (
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${ESTADO_COLORS[appt.crm_estado_cliente]}`}
                  >
                    {appt.crm_estado_cliente}
                  </Badge>
                )}
                {appt.id === current.id && (
                  <Copy className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-amber-700">
            Selecciona el registro <strong>ganador</strong> (se conservará con los datos fusionados). Los demás quedarán archivados.
          </p>

          {/* Reasignar comercial */}
          {canReassign && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <User className="w-3 h-3" /> Asignar todos a un comercial
              </label>
              <Select value={assignComId} onValueChange={setAssignComId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Mantener asignación actual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">Mantener asignación actual</SelectItem>
                  {commercials.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            size="sm"
            className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleMerge}
            disabled={isMerging}
          >
            <Merge className="w-4 h-4" />
            {isMerging ? 'Fusionando...' : 'Fusionar leads'}
          </Button>
        </div>
      )}
    </div>
  );
}
