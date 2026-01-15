import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function ConfirmationPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-8 px-4">
      <div className="max-w-md mx-auto text-center">
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
