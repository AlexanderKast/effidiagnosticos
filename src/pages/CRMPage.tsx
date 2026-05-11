import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { CRMFilters } from '@/components/crm/CRMFilters';
import { CRMTable } from '@/components/crm/CRMTable';
import { CRMSheet } from '@/components/crm/CRMSheet';
import { fetchAppointmentsByBooking, CRMFilters as Filters } from '@/lib/crmService';
import { AppointmentCRM } from '@/lib/crmUtils';
import { supabase } from '@/integrations/supabase/client';
import grupoEffiLogo from '@/assets/grupo-effi-logo.jpg';

export default function CRMPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentCRM[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAppt, setSelectedAppt] = useState<AppointmentCRM | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookingName, setBookingName] = useState('');

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/auth');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Fetch booking name
  useEffect(() => {
    if (!bookingId) return;
    supabase
      .from('booking_configs')
      .select('name')
      .eq('booking_id', bookingId)
      .single()
      .then(({ data }) => {
        if (data) setBookingName(data.name);
      });
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

  const handleRowClick = (appt: AppointmentCRM) => {
    setSelectedAppt(appt);
    setSheetOpen(true);
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
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin')}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src={grupoEffiLogo} alt="Grupo Effi" className="h-9 w-auto rounded-lg" />
          <div>
            <h1 className="text-primary-foreground font-semibold text-lg leading-tight">
              CRM — {bookingName || bookingId}
            </h1>
            <p className="text-primary-foreground/60 text-xs">Pipeline de leads</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={load}
            disabled={isLoading}
            className="ml-auto text-primary-foreground hover:bg-primary-foreground/10"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6 space-y-4">
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
      />
    </div>
  );
}
