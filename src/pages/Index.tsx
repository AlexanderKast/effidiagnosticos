import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { loadBookings } from '@/lib/bookingStore';
import { BookingConfig } from '@/lib/types';
import { Calendar, Clock, MapPin, ArrowRight, Settings } from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingConfig[]>([]);

  useEffect(() => {
    const loaded = loadBookings();
    setBookings(loaded.filter((b) => b.active));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">EC</span>
            </div>
            <span className="font-semibold text-foreground">Efficommerce</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4 mr-2" />
            Admin
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Calendar className="w-4 h-4" />
            Sistema de Agendamiento
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
            Agenda tu cita con nuestro equipo
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Selecciona el servicio que necesitas y reserva una reunión en solo 3 pasos. 
            Es rápido, fácil y recibirás confirmación inmediata.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
            Servicios disponibles
          </h2>

          {bookings.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground mb-2">No hay servicios disponibles</p>
              <p className="text-sm text-muted-foreground mb-4">
                Crea tu primer booking desde el panel de administración
              </p>
              <Button onClick={() => navigate('/admin')}>
                Ir al Admin
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bookings.map((booking) => (
                <button
                  key={booking.booking_id}
                  onClick={() => navigate(`/booking/${booking.booking_id}`)}
                  className="group bg-card rounded-xl border border-border p-6 text-left transition-all duration-200 hover:border-primary hover:shadow-large"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>

                  <h3 className="font-semibold text-foreground mb-2">
                    {booking.name}
                  </h3>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{booking.duration} min</span>
                    </div>
                    {booking.country && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        <span>{booking.country}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <p className="text-center text-sm text-muted-foreground">
          © 2025 Efficommerce. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
