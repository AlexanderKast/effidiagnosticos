import { Clock, MapPin } from 'lucide-react';
import { ServiceConfig } from '@/lib/config';

interface BookingHeaderProps {
  service: ServiceConfig | null;
}

export function BookingHeader({ service }: BookingHeaderProps) {
  return (
    <div className="text-center mb-8">
      {/* Logo */}
      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
        <span className="text-2xl font-bold text-primary">EC</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-2">
        {service?.name || 'Agenda tu cita'}
      </h1>

      {service && (
        <div className="flex items-center justify-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{service.duration} min</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{service.country}</span>
          </div>
        </div>
      )}
    </div>
  );
}
