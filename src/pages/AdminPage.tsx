import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookingConfig } from '@/lib/types';
import {
  fetchAllBookings,
  createBookingConfig,
  updateBookingConfig,
  deleteBookingConfig,
  toggleBookingConfigStatus,
  duplicateBookingConfig,
} from '@/lib/bookingService';
import { useAuth } from '@/hooks/useAuth';
import { useAdminLayout } from '@/components/admin/AdminLayout';
import { BookingFormModal } from '@/components/admin/BookingFormModal';
import { BookingsList } from '@/components/admin/BookingsList';
import { CommercialCalendarsManager } from '@/components/admin/CommercialCalendarsManager';
import { UsersManager } from '@/components/admin/UsersManager';
import { CRMPipelinesManager } from '@/components/admin/CRMPipelinesManager';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, Menu } from 'lucide-react';
import { toast } from 'sonner';

type Section = 'bookings' | 'pipelines' | 'comerciales' | 'equipo';

const SECTION_LABELS: Record<Section, string> = {
  bookings: 'Bookings',
  pipelines: 'Pipelines CRM',
  comerciales: 'Comerciales',
  equipo: 'Usuarios y Roles',
};

export default function AdminPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, canReassign, isLoading: authLoading } = useAuth();
  const { openMobileSidebar } = useAdminLayout();

  // Líderes no-admin solo pueden ver "Mi Equipo", sin importar el ?section= de la URL
  const activeSection: Section = isAdmin
    ? (searchParams.get('section') as Section) || 'bookings'
    : 'equipo';

  const [bookings, setBookings] = useState<BookingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sin rol de admin ni de lider: al CRM directamente
  useEffect(() => {
    if (!authLoading && user && !isAdmin && !canReassign) navigate('/admin/crm');
  }, [user, isAdmin, canReassign, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) loadBookings();
  }, [user, isAdmin]);

  const loadBookings = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAllBookings();
      setBookings(data);
    } catch {
      toast.error('Error al cargar los bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (booking: BookingConfig) => {
    try {
      if (editingBooking) {
        await updateBookingConfig(booking.booking_id, booking);
        toast.success('Booking actualizado correctamente');
      } else {
        await createBookingConfig(booking);
        toast.success('Booking creado correctamente');
      }
      await loadBookings();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar el booking');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteBookingConfig(deleteConfirmId);
      await loadBookings();
      toast.success('Booking eliminado');
    } catch {
      toast.error('Error al eliminar el booking');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleDuplicate = async (booking: BookingConfig) => {
    try {
      await duplicateBookingConfig(booking);
      await loadBookings();
      toast.success(`"${booking.name}" duplicado correctamente`);
    } catch {
      toast.error('Error al duplicar el booking');
    }
  };

  const handleToggleStatus = async (bookingId: string) => {
    try {
      await toggleBookingConfigStatus(bookingId);
      await loadBookings();
    } catch {
      toast.error('Error al cambiar el estado');
    }
  };

  const activeCount = bookings.filter((b) => b.active).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted"
              onClick={openMobileSidebar}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-foreground">{SECTION_LABELS[activeSection]}</h1>
              {activeSection === 'bookings' && (
                <p className="text-xs text-muted-foreground">
                  {bookings.length} bookings · {activeCount} activos
                </p>
              )}
            </div>
          </div>

          {activeSection === 'bookings' && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => { setEditingBooking(null); setIsModalOpen(true); }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Booking</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto space-y-6">

        {/* BOOKINGS */}
        {activeSection === 'bookings' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{bookings.length}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold text-green-500">{activeCount}</p>
              </div>
              <div className="bg-card rounded-xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Pausados</p>
                <p className="text-2xl font-bold text-muted-foreground">{bookings.length - activeCount}</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <BookingsList
                bookings={bookings}
                onEdit={(b) => { setEditingBooking(b); setIsModalOpen(true); }}
                onDelete={(id) => setDeleteConfirmId(id)}
                onToggleStatus={handleToggleStatus}
                onDuplicate={handleDuplicate}
              />
            )}
          </>
        )}

        {/* PIPELINES */}
        {activeSection === 'pipelines' && (
          <div className="bg-card rounded-xl border border-border p-6">
            <CRMPipelinesManager />
          </div>
        )}

        {/* COMERCIALES */}
        {activeSection === 'comerciales' && (
          <div className="bg-card rounded-xl border border-border p-6">
            <CommercialCalendarsManager />
          </div>
        )}

        {/* EQUIPO / USUARIOS */}
        {activeSection === 'equipo' && (
          <div className="bg-card rounded-xl border border-border p-6">
            <UsersManager />
          </div>
        )}

      </main>

      {/* Modal */}
      <BookingFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        booking={editingBooking}
        mode={editingBooking ? 'edit' : 'create'}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este booking?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El link dejará de funcionar inmediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
