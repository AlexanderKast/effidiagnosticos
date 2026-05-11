import { CheckCircle2, Calendar, Clock, User, Building2, Home, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import grupoEffiLogo from '@/assets/grupo-effi-logo.jpg';

interface BookingDetails {
  date?: string;
  time?: string;
  duration?: number;
  bookingName?: string;
  gcal_link?: string;
  [key: string]: string | number | undefined;
}

interface LocationState {
  webhookResponse?: Record<string, unknown>;
  bookingDetails?: BookingDetails;
}

export default function ConfirmationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  
  const webhookResponse = state?.webhookResponse;
  const bookingDetails = state?.bookingDetails;

  // Extract known fields for display
  const { date, time, duration, bookingName, gcal_link, ...otherDetails } = bookingDetails || {};

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-primary sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-center">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="max-w-md mx-auto text-center w-full">
          <div className="bg-card rounded-xl border-t-4 border-t-primary border-x border-b border-border p-8 shadow-lg animate-fade-in">
            {/* Success Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>

            {/* Main Message */}
            <h1 className="text-2xl font-bold mb-3">
              ¡Tu cita ha sido agendada!
            </h1>

            <p className="text-muted-foreground mb-6">
              Recibirás el link de Zoom por correo electrónico y en tu calendario.
            </p>

            {/* Booking Details */}
            {bookingDetails && (
              <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left space-y-3">
                <h3 className="font-semibold text-foreground text-center mb-3">
                  Detalles de tu cita
                </h3>
                
                {bookingName && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{bookingName}</span>
                  </div>
                )}
                
                {date && (
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">{date}</span>
                  </div>
                )}
                
                {time && (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground">
                      {time} {duration && `(${duration} min)`}
                    </span>
                  </div>
                )}

                {/* Other form fields */}
                {Object.entries(otherDetails).map(([label, value]) => {
                  if (!value || label === 'Acepta política') return null;
                  return (
                    <div key={label} className="flex items-start gap-3">
                      <User className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">{label}: </span>
                        <span className="text-foreground">{String(value)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info Box */}
            <div className="bg-accent rounded-xl p-4 mb-6">
              <p className="text-sm text-accent-foreground">
                Revisa tu bandeja de entrada y spam. Si no recibes el correo en los próximos 5 minutos, contáctanos.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {gcal_link && (
                <Button
                  onClick={() => window.open(String(gcal_link), '_blank')}
                  className="flex-1 min-h-[44px]"
                >
                  <CalendarPlus className="w-4 h-4 mr-2" />
                  Ver en Google Calendar
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="flex-1 min-h-[44px]"
              >
                <Home className="w-4 h-4 mr-2" />
                Volver al inicio
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <img 
              src={grupoEffiLogo} 
              alt="Grupo Effi" 
              className="h-6 w-auto rounded opacity-60"
            />
            <p className="text-xs text-muted-foreground">
              Powered by Grupo Effi
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
