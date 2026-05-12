import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { CRMFilters } from '@/components/crm/CRMFilters';
import { CRMTable } from '@/components/crm/CRMTable';
import { CRMSheet } from '@/components/crm/CRMSheet';
import { CRMNewRecordDialog } from '@/components/crm/CRMNewRecordDialog';
import { fetchAppointmentsByBooking, fetchCommercialsForBooking, CommercialOption, CRMFilters as Filters } from '@/lib/crmService';
import { AppointmentCRM } from '@/lib/crmUtils';
import { supabase } from '@/integrations/supabase/client';
import grupoEffiLogo from '@/assets/grupo-effi-logo.jpg';

const COUNTRY_LABELS: Record<string, { name: string; flag: string }> = {
  CO: { name: 'Colombia', flag: '🇨🇴' },
  GT: { name: 'Guatemala', flag: '🇬🇹' },
  CR: { name: 'Costa Rica', flag: '🇨🇷' },
  DO: { name: 'Rep. Dominicana', flag: '🇩🇴' },
  EC: { name: 'Ecuador', flag: '🇪🇨' },
};

export default function CRMPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentCRM[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentCRM | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const [bookingName, setBookingName] = useState('');
  const [commercials, setCommercials] = useState<CommercialOption[]>([]);
  const [bookingCountry, setBookingCountry] = useState('');
  const [liveConnected, setLiveConnected] = useState(false);

  // Ref para acceder a filters en el callback del canal sin crear dependencias
  const filtersRef = useRef(filters);
  useEffect(() => { filtersRef.current = filters; }, [filters]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/auth');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (!bookingId) return;
    supabase
      .from('booking_configs')
      .select('name, country')
      .eq('booking_id', bookingId)
      .single()
      .then(({ data }) => {
        if (data) {
          setBookingName(data.name);
          setBookingCountry((data.country ?? '').trim().toUpperCase());
        }
      });
    fetchCommercialsForBooking(bookingId).then(setCommercials);
  }, [bookingId]);

  const load = useCallback(async () => {
    if (!bookingId || !user || !isAdmin) return;
    setIsLoading(true);
    try {
      const data = await fetchAppointmentsByBooking(bookingId, filters);
      setAppointments(data);
    } catch (err) {
      console.error('[CRMPage] load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, user, isAdmin, filters]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Suscripción Realtime ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!bookingId || !user || !isAdmin) return;

    const channel = supabase
      .channel(`crm-pipeline-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const f = filtersRef.current;

          if (payload.eventType === 'INSERT') {
            const nuevo = payload.new as AppointmentCRM;
            // Respetar filtros activos
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
            setAppointments((prev) => {
              if (prev.some((a) => a.id === nuevo.id)) return prev;
              return [nuevo, ...prev];
            });
          }

          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as AppointmentCRM;
            setAppointments((prev) =>
              prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
            );
            setSelectedAppt((prev) =>
              prev?.id === updated.id ? { ...prev, ...updated } : prev
            );
          }

          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setAppointments((prev) => prev.filter((a) => a.id !== deleted.id));
            setSelectedAppt((prev) => (prev?.id === deleted.id ? null : prev));
          }
        }
      )
      .subscribe((status) => {
        setLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setLiveConnected(false);
    };
  }, [bookingId, user, isAdmin]);

  const handleRowClick = (appt: AppointmentCRM) => {
    setSelectedAppt(appt);
    setSheetOpen(true);
  };

  const handleCreated = (appt: AppointmentCRM) => {
    // Realtime lo insertará vía suscripción; esto es fallback optimista
    setAppointments((prev) => {
      if (prev.some((a) => a.id === appt.id)) return prev;
      return [appt, ...prev];
    });
  };

  const handleUpdated = (id: string, fields: Partial<AppointmentCRM>) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...fields } : a))
    );
    if (selectedAppt?.id === id) {
      setSelectedAppt((prev) => (prev ? { ...prev, ...fields } : prev));
    }
  };

  if (authLoading || (!user && !authLoading)) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-primary sticky top-0 z-50">
        <div className="w-full px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="text-primary-foreground hover:bg-primary-foreground/10 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={grupoEffiLogo} alt="Grupo Effi" className="h-9 w-auto rounded-lg hidden sm:block shrink-0" />
          <div className="min-w-0">
            <h1 className="text-primary-foreground font-semibold text-base sm:text-lg leading-tight truncate">
              CRM — {bookingName || bookingId}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-primary-foreground/60 text-xs">Pipeline de leads</p>
              {bookingCountry && COUNTRY_LABELS[bookingCountry] && (
                <span className="text-primary-foreground/80 text-xs font-medium">
                  · {COUNTRY_LABELS[bookingCountry].flag} {COUNTRY_LABELS[bookingCountry].name}
                </span>
              )}
              {/* Indicador en vivo */}
              <span className={`flex items-center gap-1 text-xs font-medium ${liveConnected ? 'text-green-300' : 'text-primary-foreground/40'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${liveConnected ? 'bg-green-400 animate-pulse' : 'bg-primary-foreground/30'}`} />
                {liveConnected ? 'En vivo' : 'Conectando...'}
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setNewRecordOpen(true)}
              className="gap-1.5"
            >
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

      {/* Content */}
      <main className="flex-1 w-full px-4 py-4 space-y-4">
        <CRMFilters
          filters={filters}
          onChange={setFilters}
          total={appointments.length}
        />

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Cargando registros...
          </div>
        ) : (
          <CRMTable
            appointments={appointments}
            commercials={commercials}
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
        commercials={commercials}
      />

      <CRMNewRecordDialog
        open={newRecordOpen}
        onOpenChange={setNewRecordOpen}
        bookingId={bookingId!}
        commercials={commercials}
        onCreated={handleCreated}
      />
    </div>
  );
}
