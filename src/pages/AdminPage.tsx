import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingConfig } from '@/lib/types';
import {
  fetchAllBookings,
  createBookingConfig,
  updateBookingConfig,
  deleteBookingConfig,
  toggleBookingConfigStatus,
} from '@/lib/bookingService';
import { useAuth } from '@/hooks/useAuth';
import { BookingFormModal } from '@/components/admin/BookingFormModal';
import { BookingsList } from '@/components/admin/BookingsList';
import { TeamManagement } from '@/components/admin/TeamManagement';
import { CommercialCalendarsManager } from '@/components/admin/CommercialCalendarsManager';
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
import { Plus, Calendar, ArrowLeft, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  
  const [bookings, setBookings] = useState<BookingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error('Acceso denegado. Debes ser administrador.');
      navigate('/auth');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Load bookings on mount
  useEffect(() => {
    if (user && isAdmin) {
      loadBookings();
    }
  }, [user, isAdmin]);

  const loadBookings = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAllBookings();
      setBookings(data);
    } catch (error) {
      console.error('Error loading bookings:', error);
      toast.error('Error al cargar los bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  const handleEdit = (booking: BookingConfig) => {
    setEditingBooking(booking);
    setIsModalOpen(true);
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
      console.error('Error saving booking:', error);
      toast.error(error.message || 'Error al guardar el booking');
    }
  };

  const handleDelete = (bookingId: string) => {
    setDeleteConfirmId(bookingId);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      try {
        await deleteBookingConfig(deleteConfirmId);
        await loadBookings();
        toast.success('Booking eliminado');
      } catch (error) {
        console.error('Error deleting booking:', error);
        toast.error('Error al eliminar el booking');
      } finally {
        setDeleteConfirmId(null);
      }
    }
  };

  const handleToggleStatus = async (bookingId: string) => {
    try {
      await toggleBookingConfigStatus(bookingId);
      await loadBookings();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Error al cambiar el estado');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not admin (will redirect)
  if (!user || !isAdmin) {
    return null;
  }

  const activeCount = bookings.filter((b) => b.active).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-semibold text-foreground">Panel de Administración</h1>
                  <p className="text-sm text-muted-foreground">
                    {bookings.length} bookings • {activeCount} activos
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden md:block">
                {user.email}
              </span>
              <Button onClick={handleCreateNew} className="gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Booking
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">Total Bookings</p>
            <p className="text-2xl font-bold text-foreground">{bookings.length}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">Activos</p>
            <p className="text-2xl font-bold text-green-500">{activeCount}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground">Pausados</p>
            <p className="text-2xl font-bold text-muted-foreground">
              {bookings.length - activeCount}
            </p>
          </div>
        </div>

        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Links de Booking</h2>
            <p className="text-sm text-muted-foreground">
              Cada booking genera una mini-landing en /booking/[id]
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <BookingsList
            bookings={bookings}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
          />
        )}

        {/* Comerciales */}
        <div className="mt-8 bg-card rounded-xl border border-border p-6">
          <CommercialCalendarsManager />
        </div>

        {/* Team Management */}
        <div className="mt-8">
          <TeamManagement />
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2">Cómo funciona</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Cada booking se asigna a un comercial con su calendario</li>
              <li>• Las citas se guardan en Supabase como fuente de verdad</li>
              <li>• Google Calendar se sincroniza automáticamente</li>
              <li>• Puedes pausar/activar bookings sin eliminarlos</li>
            </ul>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2">Estructura de URLs</h3>
            <div className="space-y-2 font-mono text-sm">
              <p className="text-primary">/booking/ventas-colombia</p>
              <p className="text-primary">/booking/diagnostico-inicial</p>
              <p className="text-primary">/booking/soporte-mx</p>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              El ID del booking define la URL automáticamente
            </p>
          </div>
        </div>
      </main>

      {/* Create/Edit Modal */}
      <BookingFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        booking={editingBooking}
        mode={editingBooking ? 'edit' : 'create'}
      />

      {/* Delete Confirmation */}
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
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
