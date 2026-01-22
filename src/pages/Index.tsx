import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { fetchActiveBookings } from '@/lib/bookingService';
import { BookingConfig } from '@/lib/types';
import { Calendar, Clock, MapPin, ArrowRight, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import grupoEffiLogo from '@/assets/grupo-effi-logo.jpg';

export default function Index() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await fetchActiveBookings();
        setBookings(data);
      } catch (error) {
        console.error('Error loading bookings:', error);
        toast.error('No se pudieron cargar los servicios');
        setBookings([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-primary sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <img 
              src={grupoEffiLogo} 
              alt="Grupo Effi" 
              className="h-10 md:h-12 w-auto rounded-lg"
            />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <Settings className="w-4 h-4 mr-2" />
            Admin
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="py-20 px-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, hsl(218 100% 31%), hsl(218 80% 45%), hsl(218 100% 35%))'
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-60 h-60 bg-white rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/20 text-white px-4 py-2 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
            <Calendar className="w-4 h-4" />
            Sistema de Agendamiento
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Agenda tu cita con Grupo Effi
          </h1>
          
          <p className="text-lg text-white/90 mb-8 max-w-xl mx-auto">
            Selecciona el servicio que necesitas y reserva una reunión en solo 3 pasos. 
            Es rápido, fácil y recibirás confirmación inmediata.
          </p>

          <Button 
            size="lg"
            onClick={() => {
              const servicesSection = document.getElementById('services');
              servicesSection?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="bg-white text-primary hover:bg-white/90 font-semibold px-8 py-6 text-lg rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
          >
            Agendar ahora
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-20 px-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-8 text-center">
            Servicios disponibles
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : bookings.length === 0 ? (
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
                  className="group bg-card rounded-xl border-t-4 border-t-primary border-x border-b border-border p-6 text-left transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
                      <Calendar className="w-6 h-6 text-primary" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                  </div>

                  <h3 className="font-semibold text-foreground mb-2 text-lg">
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
      <footer className="border-t border-border py-8 px-4 bg-card">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <img 
            src={grupoEffiLogo} 
            alt="Grupo Effi" 
            className="h-8 w-auto rounded opacity-80"
          />
          <p className="text-center text-sm text-muted-foreground">
            © 2025 Grupo Effi. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
