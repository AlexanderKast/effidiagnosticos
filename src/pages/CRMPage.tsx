import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Menu, RefreshCw, Plus, Kanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { CRMFilters } from '@/components/crm/CRMFilters';
import { CRMTable } from '@/components/crm/CRMTable';
import { CRMSheet } from '@/components/crm/CRMSheet';
import { CRMNewRecordDialog } from '@/components/crm/CRMNewRecordDialog';
import { fetchCRMRecords, fetchCommercialsForBooking, CommercialOption, CRMFilters as Filters } from '@/lib/crmService';
import { fetchAllBookings } from '@/lib/bookingService';
import { BookingConfig } from '@/lib/types';
import { AppointmentCRM } from '@/lib/crmUtils';
import { useDuplicates } from '@/hooks/useDuplicates';
import { CRMPipeline, fetchPipelines } from '@/lib/crmPipelinesService';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import grupoEffiLogo from '@/assets/grupo-effi-logo.jpg';
import { useAdminLayout } from '@/components/admin/AdminLayout';

export default function CRMPage() {
  const { bookingId: urlBookingId } = useParams<{ bookingId?: string }>();
  const navigate = useNavigate();
  const { user, canReassign, commercialProfile, isLoading: authLoading } = useAuth();
  const { openMobileSidebar } = useAdminLayout();

  const [appointments, setAppointments] = useState<AppointmentCRM[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentCRM | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newRecordOpen, setNewRecordOpen] = useState(false);

  // Pipeline como filtro principal
  const [pipelines, setPipelines] = useState<CRMPipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // Booking como filtro secundario (para registros con booking_id de URL)
  const [bookings, setBookings] = useState<BookingConfig[]>([]);
  const [selectedBookingId] = useState<string | null>(urlBookingId ?? null);

  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);

  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  const selectedPipelineIdRef = useRef(selectedPipelineId);
  useEffect(() => { selectedPipelineIdRef.current = selectedPipelineId; }, [selectedPipelineId]);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchPipelines().then(setPipelines).catch(() => {});
    fetchAllBookings().then(setBookings).catch(() => {});
  }, []);

  useEffect(() => {
    // Solo líderes/admins necesitan la lista completa (para reasignar)
    if (!canReassign) return;
    supabase
      .from('commercial_calendars')
      .select('id, name, email')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => setCommercials((data ?? []) as CommercialOption[]));
  }, [canReassign]);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await fetchCRMRecords({
        ...filters,
        pipelineId: selectedPipelineId ?? undefined,
        bookingId: selectedBookingId ?? undefined,
      });
      setAppointments(data);
    } catch (err) {
      console.error('[CRMPage] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, filters, selectedPipelineId, selectedBookingId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('crm-pipeline-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (payload) => {
        const f = filtersRef.current;
        const pipelineFilter = selectedPipelineIdRef.current;

        if (payload.eventType === 'INSERT') {
          const nuevo = payload.new as AppointmentCRM;
          if (pipelineFilter === '__none__' && nuevo.crm_pipeline_id !== null) return;
          if (pipelineFilter && pipelineFilter !== '__none__' && nuevo.crm_pipeline_id !== pipelineFilter) return;
          if (f.estado && nuevo.crm_estado_cliente !== f.estado) return;
          if (f.soloVentas && !nuevo.crm_venta_realizada) return;
          if (f.search) {
            const q = f.search.toLowerCase();
            const match =
              nuevo.lead_name?.toLowerCase().includes(q) ||
              nuevo.lead_email?.toLowerCase().includes(q) ||
              nuevo.assigned_commercial_name?.toLowerCase().includes(q);
            if (!match) return;
          }
          setAppointments((prev) => prev.some((a) => a.id === nuevo.id) ? prev : [nuevo, ...prev]);
        }

        if (payload.eventType === 'UPDATE') {
          const updated = payload.new as AppointmentCRM;
          setAppointments((prev) => prev.map((a) => a.id === updated.id ? { ...a, ...updated } : a));
          setSelectedAppt((prev) => prev?.id === updated.id ? { ...prev, ...updated } : prev);
        }

        if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string };
          setAppointments((prev) => prev.filter((a) => a.id !== deleted.id));
          setSelectedAppt((prev) => prev?.id === deleted.id ? null : prev);
        }
      })
      .subscribe((status) => setLiveConnected(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(channel); setLiveConnected(false); };
  }, [user]);

  const handleRowClick = (appt: AppointmentCRM) => { setSelectedAppt(appt); setSheetOpen(true); };

  const handleCreated = (appt: AppointmentCRM) => {
    setAppointments((prev) => prev.some((a) => a.id === appt.id) ? prev : [appt, ...prev]);
  };

  const handleUpdated = (id: string, fields: Partial<AppointmentCRM>) => {
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, ...fields } : a));
    if (selectedAppt?.id === id) setSelectedAppt((prev) => prev ? { ...prev, ...fields } : prev);
  };

  const handleArchived = (id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setSelectedAppt(null);
  };

  const handleMerged = (winnerId: string, archivedIds: string[]) => {
    setAppointments((prev) => prev.filter((a) => !archivedIds.includes(a.id)));
    setSelectedAppt(null);
    setSheetOpen(false);
  };

  const { duplicatesMap, getDuplicatesFor } = useDuplicates(appointments);

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  if (authLoading || (!user && !authLoading)) return null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="border-b border-border bg-primary sticky top-0 z-50">
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={openMobileSidebar}
            className="md:hidden text-primary-foreground hover:bg-primary-foreground/10 shrink-0"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <img src={grupoEffiLogo} alt="Grupo Effi" className="h-9 w-auto rounded-lg hidden sm:block shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-primary-foreground font-semibold text-base sm:text-lg leading-tight">
              CRM Global
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-primary-foreground/60 text-xs">Pipeline de leads</p>
              <span className={`flex items-center gap-1 text-xs font-medium ${liveConnected ? 'text-green-300' : 'text-primary-foreground/40'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${liveConnected ? 'bg-green-400 animate-pulse' : 'bg-primary-foreground/30'}`} />
                {liveConnected ? 'En vivo' : 'Conectando...'}
              </span>
            </div>
          </div>

          {/* Pipeline filter */}
          <Select
            value={selectedPipelineId ?? '__all__'}
            onValueChange={(v) => setSelectedPipelineId(v === '__all__' ? null : v)}
          >
            <SelectTrigger className="w-44 h-8 text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground [&>svg]:text-primary-foreground/60">
              <div className="flex items-center gap-1.5 min-w-0">
                {selectedPipeline ? (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedPipeline.color }}
                  />
                ) : (
                  <Kanban className="w-3 h-3 shrink-0" />
                )}
                <SelectValue placeholder="Todos los pipelines" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los pipelines</SelectItem>
              <SelectItem value="__none__">Sin pipeline</SelectItem>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => setNewRecordOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo registro</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={load}
              disabled={isLoading}
              className="text-primary-foreground hover:bg-primary-foreground/10"
              title="Recargar"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 py-4 space-y-4">
        <CRMFilters filters={filters} onChange={setFilters} total={appointments.length} />

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Cargando registros...
          </div>
        ) : (
          <CRMTable
            appointments={appointments}
            commercials={commercials}
            duplicatesMap={duplicatesMap}
            onRowClick={handleRowClick}
            onUpdated={handleUpdated}
          />
        )}
      </main>

      <CRMSheet
        appointment={selectedAppt}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={handleUpdated}
        onArchived={handleArchived}
        commercials={commercials}
        canReassign={canReassign}
        duplicates={selectedAppt ? getDuplicatesFor(selectedAppt) : []}
        onMerged={handleMerged}
      />

      <CRMNewRecordDialog
        open={newRecordOpen}
        onOpenChange={setNewRecordOpen}
        bookingId={selectedBookingId}
        bookings={bookings}
        pipelines={pipelines}
        selectedPipelineId={selectedPipelineId}
        bookingCountry="CO"
        commercials={commercials}
        canReassign={canReassign}
        selfCommercial={commercialProfile}
        onCreated={handleCreated}
      />
    </div>
  );
}
