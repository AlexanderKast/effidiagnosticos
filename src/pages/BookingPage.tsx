import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { DatePickerStep } from '@/components/booking/DatePickerStep';
import { TimeSlotStep } from '@/components/booking/TimeSlotStep';
import { BookingForm } from '@/components/booking/BookingForm';
import { BookingHeader } from '@/components/booking/BookingHeader';
import { Button } from '@/components/ui/button';
import { config, defaultServices, ServiceConfig } from '@/lib/config';
import { ArrowLeft } from 'lucide-react';

const STEP_LABELS = ['Fecha', 'Hora', 'Datos'];

export default function BookingPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [service, setService] = useState<ServiceConfig | null>(null);

  // Find service configuration
  useEffect(() => {
    const foundService = defaultServices.find((s) => s.service_id === serviceId);
    setService(foundService || null);
  }, [serviceId]);

  // Fetch availability when date is selected
  useEffect(() => {
    if (!selectedDate || !serviceId) return;

    const fetchAvailability = async () => {
      setIsLoadingSlots(true);
      setAvailableSlots([]);

      try {
        const response = await fetch(config.N8N_GET_AVAILABILITY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: serviceId,
            country: service?.country || '',
            date: format(selectedDate, 'yyyy-MM-dd'),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setAvailableSlots(data.available_slots || []);
        } else {
          // Demo fallback - show mock slots
          setAvailableSlots(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
        }
      } catch (error) {
        // Demo fallback - show mock slots
        console.log('Using demo slots (n8n not connected)');
        setAvailableSlots(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchAvailability();
  }, [selectedDate, serviceId, service?.country]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setCurrentStep(2);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep(3);
  };

  const handleFormSubmit = async (formData: {
    name: string;
    email: string;
    country: string;
    company?: string;
    notes?: string;
  }) => {
    if (!selectedDate || !selectedTime) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(config.N8N_CREATE_BOOKING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          country: formData.country,
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: selectedTime,
          name: formData.name,
          email: formData.email,
          company: formData.company,
          notes: formData.notes,
        }),
      });

      if (response.ok) {
        navigate('/confirmacion');
      } else {
        // Demo fallback - navigate anyway
        navigate('/confirmacion');
      }
    } catch (error) {
      // Demo fallback - navigate anyway
      console.log('Demo mode: Navigating to confirmation');
      navigate('/confirmacion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Back button */}
        {currentStep > 1 && (
          <Button
            variant="ghost"
            onClick={goBack}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        )}

        {/* Main Card */}
        <div className="booking-card">
          <BookingHeader service={service} />
          
          <StepIndicator
            currentStep={currentStep}
            totalSteps={3}
            labels={STEP_LABELS}
          />

          {/* Step Content */}
          {currentStep === 1 && (
            <DatePickerStep
              selectedDate={selectedDate}
              onSelectDate={handleDateSelect}
            />
          )}

          {currentStep === 2 && (
            <TimeSlotStep
              availableSlots={availableSlots}
              selectedTime={selectedTime}
              onSelectTime={handleTimeSelect}
              isLoading={isLoadingSlots}
              selectedDate={selectedDate}
            />
          )}

          {currentStep === 3 && (
            <BookingForm
              onSubmit={handleFormSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Powered by Efficommerce
        </p>
      </div>
    </div>
  );
}
