import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookingConfig, BookingFormData } from '@/lib/types';
import { fetchBookingById } from '@/lib/bookingService';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { DatePickerStep } from '@/components/booking/DatePickerStep';
import { TimeSlotStep } from '@/components/booking/TimeSlotStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Clock,
  MapPin,
  CheckCircle2,
  Target,
  UserCheck,
  UserX,
  AlertCircle,
  Shield,
  Video,
  Mail,
  Loader2,
} from 'lucide-react';

const STEP_LABELS = ['Fecha', 'Hora', 'Datos'];

export default function BookingPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<BookingConfig | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<BookingFormData>({
    name: '',
    email: '',
    company: '',
    notes: '',
    acceptedPolicy: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load booking config from database
  useEffect(() => {
    const loadBooking = async () => {
      if (!bookingId) {
        setNotFound(true);
        setIsLoadingBooking(false);
        return;
      }

      try {
        const found = await fetchBookingById(bookingId);
        if (!found || !found.active) {
          setNotFound(true);
        } else {
          setBooking(found);
        }
      } catch (error) {
        console.error('Error loading booking:', error);
        setNotFound(true);
      } finally {
        setIsLoadingBooking(false);
      }
    };

    loadBooking();
  }, [bookingId]);

  // Fetch availability - called directly when date is selected
  const fetchAvailability = async (date: Date) => {
    if (!booking) return;

    // Reset state before fetching
    setSelectedTime(null);
    setAvailableSlots([]);
    setIsLoadingSlots(true);

    try {
      if (booking.n8n_get_availability_url) {
        console.log('Fetching availability from:', booking.n8n_get_availability_url);
        console.log('Request body:', { booking_id: booking.booking_id, date: format(date, 'yyyy-MM-dd') });
        
        const response = await fetch(booking.n8n_get_availability_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: booking.booking_id,
            date: format(date, 'yyyy-MM-dd'),
          }),
        });

        console.log('Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Response data:', data);
          // Support both "slots" and "available_slots" from n8n response
          const slots = data.slots || data.available_slots || [];
          setAvailableSlots(slots);
          setIsLoadingSlots(false);
          return;
        }
      }
      // Demo fallback if no URL configured
      console.log('No n8n URL configured or request failed, using demo slots');
      setAvailableSlots(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
    } catch (error) {
      console.error('Error fetching availability:', error);
      // Demo fallback on error
      setAvailableSlots(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Handle date selection - triggers availability fetch IMMEDIATELY
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
    setCurrentStep(2);
    // Trigger webhook immediately on date selection
    fetchAvailability(date);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep(3);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) errors.name = 'Nombre requerido';
    if (!formData.email.trim()) {
      errors.email = 'Email requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    if (booking?.requirePolicyAcceptance && !formData.acceptedPolicy) {
      errors.policy = 'Debes aceptar la política de datos';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !booking || !selectedDate || !selectedTime) return;

    setIsSubmitting(true);

    try {
      if (booking.n8n_create_booking_url) {
        await fetch(booking.n8n_create_booking_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            booking_id: booking.booking_id,
            name: formData.name,
            email: formData.email,
            company: formData.company,
            notes: formData.notes,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: selectedTime,
          }),
        });
      }
      navigate('/confirmacion');
    } catch (error) {
      console.log('Demo mode: navigating to confirmation');
      navigate('/confirmacion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Not Found State
  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Booking no encontrado
          </h1>
          <p className="text-muted-foreground mb-6">
            Este link de agendamiento no existe o ya no está disponible.
          </p>
          <Button onClick={() => navigate('/')}>Volver al inicio</Button>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoadingBooking || !booking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">EC</span>
          </div>
          <span className="font-medium text-foreground">Efficommerce</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left Column - Context */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Info */}
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-3">
                {booking.title}
              </h1>
              <p className="text-muted-foreground">{booking.subtitle}</p>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{booking.duration} minutos</span>
                </div>
                {booking.country && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{booking.country}</span>
                  </div>
                )}
              </div>
            </div>

            {/* What will be covered */}
            {booking.topics.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Qué veremos en la reunión
                  </h3>
                </div>
                <ul className="space-y-2">
                  {booking.topics.filter(t => t.text).map((topic) => (
                    <li key={topic.id} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                      {topic.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Who is it for */}
            {booking.targetAudience.length > 0 && (
              <div className="bg-accent/50 rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <UserCheck className="w-5 h-5 text-success" />
                  <h3 className="font-semibold text-foreground">Para quién es</h3>
                </div>
                <ul className="space-y-2">
                  {booking.targetAudience.filter(t => t.text).map((item) => (
                    <li key={item.id} className="text-sm text-muted-foreground">
                      • {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Who is it NOT for */}
            {booking.notFor.length > 0 && (
              <div className="bg-muted/50 rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <UserX className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">No es para ti si...</h3>
                </div>
                <ul className="space-y-2">
                  {booking.notFor.filter(t => t.text).map((item) => (
                    <li key={item.id} className="text-sm text-muted-foreground">
                      • {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Expectations */}
            {booking.expectations.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Qué esperamos de ti
                  </h3>
                </div>
                <ul className="space-y-2">
                  {booking.expectations.filter(t => t.text).map((item) => (
                    <li key={item.id} className="text-sm text-muted-foreground">
                      • {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trust signals */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
              <div className="flex items-center gap-1">
                <Video className="w-4 h-4" />
                <span>Zoom</span>
              </div>
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4" />
                <span>Confirmación por email</span>
              </div>
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span>Datos protegidos</span>
              </div>
            </div>
          </div>

          {/* Right Column - Booking Flow */}
          <div className="lg:col-span-3">
            <div className="booking-card sticky top-24">
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

              <StepIndicator
                currentStep={currentStep}
                totalSteps={3}
                labels={STEP_LABELS}
              />

              {/* Step 1: Date */}
              {currentStep === 1 && (
                <DatePickerStep
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                />
              )}

              {/* Step 2: Time */}
              {currentStep === 2 && (
                <TimeSlotStep
                  availableSlots={availableSlots}
                  selectedTime={selectedTime}
                  onSelectTime={handleTimeSelect}
                  isLoading={isLoadingSlots}
                  selectedDate={selectedDate}
                />
              )}

              {/* Step 3: Form */}
              {currentStep === 3 && (
                <div className="animate-fade-in">
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Completa tus datos
                  </h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    {selectedDate && format(selectedDate, "EEEE d 'de' MMMM", { locale: es })} a las {selectedTime}
                  </p>

                  <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Tu nombre completo"
                        className={formErrors.name ? 'border-destructive' : ''}
                      />
                      {formErrors.name && (
                        <p className="text-sm text-destructive">{formErrors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="tu@email.com"
                        className={formErrors.email ? 'border-destructive' : ''}
                      />
                      {formErrors.email && (
                        <p className="text-sm text-destructive">{formErrors.email}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company">Empresa (opcional)</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Nombre de tu empresa"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notas (opcional)</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="¿Algo que debamos saber antes de la reunión?"
                        rows={3}
                      />
                    </div>

                    {/* Policy Checkbox */}
                    {booking.requirePolicyAcceptance && (
                      <div className="pt-4 border-t border-border">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="policy"
                            checked={formData.acceptedPolicy}
                            onCheckedChange={(checked) =>
                              setFormData({ ...formData, acceptedPolicy: checked as boolean })
                            }
                            className={formErrors.policy ? 'border-destructive' : ''}
                          />
                          <div>
                            <Label htmlFor="policy" className="text-sm leading-relaxed cursor-pointer">
                              {booking.policyText}
                            </Label>
                            {formErrors.policy && (
                              <p className="text-sm text-destructive mt-1">{formErrors.policy}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold mt-6"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Agendando...
                        </>
                      ) : (
                        'Agendar reunión'
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <p className="text-center text-sm text-muted-foreground">
          © 2025 Efficommerce. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
