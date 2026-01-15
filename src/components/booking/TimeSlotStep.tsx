import { cn } from '@/lib/utils';
import { Clock, Loader2 } from 'lucide-react';

interface TimeSlotStepProps {
  availableSlots: string[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  isLoading: boolean;
  selectedDate: Date | null;
}

export function TimeSlotStep({
  availableSlots,
  selectedTime,
  onSelectTime,
  isLoading,
  selectedDate,
}: TimeSlotStepProps) {
  if (isLoading) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Cargando horarios disponibles...</p>
      </div>
    );
  }

  if (!selectedDate) {
    return (
      <div className="animate-fade-in text-center py-12">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Selecciona una fecha primero</p>
      </div>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <div className="animate-fade-in text-center py-12">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No hay horarios disponibles para esta fecha</p>
        <p className="text-sm text-muted-foreground mt-2">Por favor, selecciona otra fecha</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold text-foreground mb-6">
        Selecciona un horario
      </h2>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {availableSlots.map((slot) => (
          <button
            key={slot}
            onClick={() => onSelectTime(slot)}
            className={cn(
              'time-slot',
              selectedTime === slot && 'time-slot-selected'
            )}
          >
            {slot}
          </button>
        ))}
      </div>

      {selectedTime && (
        <p className="mt-6 text-center text-muted-foreground">
          Horario seleccionado:{' '}
          <span className="font-medium text-foreground">{selectedTime}</span>
        </p>
      )}
    </div>
  );
}
