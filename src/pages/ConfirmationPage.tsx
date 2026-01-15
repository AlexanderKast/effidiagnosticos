import { CheckCircle2, Calendar, Clock, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

interface BookingDetails {
  date?: string;
  time?: string;
  duration?: number;
  bookingName?: string;
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
  const { date, time, duration, bookingName, ...otherDetails } = bookingDetails || {};

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-8 px-4">
      <div className="max-w-md mx-auto text-center w-full">
        <div className="booking-card animate-slide-up">
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </div>

          {/* Main Message */}
          <h1 className="text-2xl font-bold text-foreground mb-3">
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

          {/* Webhook Response Data */}
          {webhookResponse && Object.keys(webhookResponse).length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold text-foreground text-center mb-3">
                Información adicional
              </h3>
              <div className="space-y-2">
                {Object.entries(webhookResponse).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="text-muted-foreground">{key}: </span>
                    <span className="text-foreground">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-accent rounded-xl p-4 mb-6">
            <p className="text-sm text-accent-foreground">
              Revisa tu bandeja de entrada y spam. Si no recibes el correo en los próximos 5 minutos, contáctanos.
            </p>
          </div>

          {/* Action Button */}
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Volver al inicio
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Powered by Efficommerce
        </p>
      </div>
    </div>
  );
}
