import { useState, useEffect } from 'react';
import { BookingConfig } from '@/lib/types';
import {
  loadBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  toggleBookingStatus,
} from '@/lib/bookingStore';
import { BookingFormModal } from '@/components/admin/BookingFormModal';
import { BookingsList } from '@/components/admin/BookingsList';
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
import { Plus, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AdminPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingConfig[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<BookingConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Load bookings on mount
  useEffect(() => {
    setBookings(loadBookings());
  }, []);

  const handleCreateNew = () => {
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  const handleEdit = (booking: BookingConfig) => {
    setEditingBooking(booking);
    setIsModalOpen(true);
  };

  const handleSave = (booking: BookingConfig) => {
    if (editingBooking) {
      // Update existing
      updateBooking(booking.booking_id, booking);
      toast.success('Booking actualizado correctamente');
    } else {
      // Create new
      createBooking(booking);
      toast.success('Booking creado correctamente');
    }
    setBookings(loadBookings());
  };

  const handleDelete = (bookingId: string) => {
    setDeleteConfirmId(bookingId);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteBooking(deleteConfirmId);
      setBookings(loadBookings());
      toast.success('Booking eliminado');
      setDeleteConfirmId(null);
    }
  };

  const handleToggleStatus = (bookingId: string) => {
    toggleBookingStatus(bookingId);
    setBookings(loadBookings());
  };

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
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Booking
            </Button>
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
            <p className="text-2xl font-bold text-success">{activeCount}</p>
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

        {/* Bookings List */}
        <BookingsList
          bookings={bookings}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleStatus={handleToggleStatus}
        />

        {/* Info Cards */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2">Cómo funciona</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Cada booking tiene sus propias URLs de n8n</li>
              <li>• El frontend solo renderiza, no tiene lógica de negocio</li>
              <li>• Los horarios vienen de n8n (o modo demo si no está configurado)</li>
              <li>• Puedes pausar/activar bookings sin eliminarlos</li>
            </ul>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2">Estructura de URLs</h3>
            <div className="space-y-2 font-mono text-sm">
              <p className="text-primary">/booking/ventas-colombia</p>
              <p className="text-primary">/booking/onboarding-latam</p>
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
