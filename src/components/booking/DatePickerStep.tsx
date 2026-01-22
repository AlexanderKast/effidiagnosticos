import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface DatePickerStepProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

export function DatePickerStep({ selectedDate, onSelectDate }: DatePickerStepProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Get the day of week for the first day (0 = Sunday)
  const startDayOfWeek = monthStart.getDay();

  const isPastDate = (date: Date) => {
    return isBefore(startOfDay(date), startOfDay(new Date()));
  };

  const isSelected = (date: Date) => {
    return selectedDate && format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-semibold mb-6">
        Selecciona una fecha
      </h2>

      <div className="bg-secondary/50 rounded-xl p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="text-primary hover:bg-accent hover:text-primary"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-lg font-semibold capitalize text-foreground">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="text-primary hover:bg-accent hover:text-primary"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Week Days Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-primary/70 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month start */}
          {Array.from({ length: startDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} className="date-cell" />
          ))}

          {/* Days of the month */}
          {days.map((day) => {
            const disabled = isPastDate(day) || !isSameMonth(day, currentMonth);
            const selected = isSelected(day);
            const today = isToday(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => !disabled && onSelectDate(day)}
                disabled={disabled}
                className={cn(
                  'date-cell transition-all duration-200',
                  !disabled && !selected && 'text-primary hover:bg-primary/10',
                  selected && 'date-cell-selected bg-primary text-primary-foreground',
                  disabled && 'date-cell-disabled text-muted-foreground/50',
                  today && !selected && 'ring-2 ring-primary font-bold',
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <p className="mt-4 text-center text-muted-foreground">
          Fecha seleccionada:{' '}
          <span className="font-medium text-primary">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
          </span>
        </p>
      )}
    </div>
  );
}
