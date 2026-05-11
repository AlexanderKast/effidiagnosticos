import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookingConfig, FormField } from '@/lib/types';
import { fetchBookingById } from '@/lib/bookingService';
import { useTrackingPixels } from '@/hooks/useTrackingPixels';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { DatePickerStep } from '@/components/booking/DatePickerStep';
import { TimeSlotStep } from '@/components/booking/TimeSlotStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import grupoEffiLogo from '@/assets/grupo-effi-logo.jpg';

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

  // Form state - now dynamic based on formFields
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  // Check if a field should be visible based on its condition
  const isFieldVisible = useCallback((field: FormField): boolean => {
    if (!field.condition) return true;
    
    const { fieldId, operator, value } = field.condition;
    const fieldValue = formData[fieldId] || '';

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return fieldValue.toLowerCase().includes((value || '').toLowerCase());
      case 'not_empty':
        return fieldValue.trim() !== '';
      default:
        return true;
    }
  }, [formData]);

  // Get visible fields
  const getVisibleFields = useCallback(() => {
    if (!booking) return [];
    return booking.formFields.filter(isFieldVisible);
  }, [booking, isFieldVisible]);

  // Initialize tracking pixels
  const { trackEvent } = useTrackingPixels({
    pixels: booking?.trackingPixels || [],
    bookingId: bookingId || '',
  });

  // Track page view when booking loads
  useEffect(() => {
    if (booking) {
      trackEvent('page_view');
      trackEvent('start_booking');
    }
  }, [booking, trackEvent]);

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

    setSelectedTime(null);
    setAvailableSlots([]);
    setIsLoadingSlots(true);

    const fecha = format(date, 'yyyy-MM-dd');

    try {
      // Route: Edge Function (new) vs N8N (legacy)
      if (booking.use_supabase_backend) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetch(`${supabaseUrl}/functions/v1/validate-availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ booking_id: booking.booking_id, fecha }),
        });

        if (response.ok) {
          const { data } = await response.json();
          const available = (data.slots as Array<{ time: string; available: boolean }>)
            .filter(s => s.available)
            .map(s => s.time);
          setAvailableSlots(available);
          return;
        }
      }

      setAvailableSlots([]);
    } catch (error) {
      console.error('Error fetching availability:', error);
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
    // Track date selection
    trackEvent('select_date', { date: format(date, 'yyyy-MM-dd') });
    // Trigger webhook immediately on date selection
    fetchAvailability(date);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep(3);
    // Track time selection
    trackEvent('select_time', { time });
  };

  const validateForm = (): boolean => {
    if (!booking) return false;
    const errors: Record<string, string> = {};

    // Validate each required field dynamically (only visible fields)
    const visibleFields = getVisibleFields();
    visibleFields.forEach(field => {
      // Skip hidden fields
      if (field.type === 'hidden') return;
      
      if (field.required) {
        const value = formData[field.id]?.trim() || '';
        if (!value) {
          errors[field.id] = `${field.label} es requerido`;
        } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors[field.id] = 'Email inválido';
        } else if (field.type === 'url' && !/^https?:\/\/.+/.test(value)) {
          errors[field.id] = 'URL inválida (debe comenzar con http:// o https://)';
        } else if (field.type === 'number') {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            errors[field.id] = 'Debe ser un número válido';
          } else if (field.min !== undefined && numValue < field.min) {
            errors[field.id] = `El valor mínimo es ${field.min}`;
          } else if (field.max !== undefined && numValue > field.max) {
            errors[field.id] = `El valor máximo es ${field.max}`;
          }
        } else if (field.type === 'checkbox' && value !== 'true') {
          errors[field.id] = `Debes aceptar ${field.label}`;
        }
      }
    });

    if (booking.requirePolicyAcceptance && !acceptedPolicy) {
      errors.policy = 'Debes aceptar la política de datos';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !booking || !selectedDate || !selectedTime) return;

    setIsSubmitting(true);
    
    // Track form submission
    trackEvent('form_submit', { 
      date: format(selectedDate, 'yyyy-MM-dd'), 
      time: selectedTime 
    });

    try {
      // Transform formData to use visible labels instead of internal IDs
      const formDataWithLabels: Record<string, string> = {};
      booking.formFields.forEach(field => {
        if (formData[field.id] !== undefined) {
          let displayValue = formData[field.id];
          
          // For select, radio, multiselect - convert values to visible labels
          if ((field.type === 'select' || field.type === 'radio') && field.options) {
            const option = field.options.find(opt => opt.value === displayValue);
            if (option) {
              displayValue = option.label;
            }
          } else if (field.type === 'multiselect' && field.options) {
            const selectedValues = displayValue.split(',').filter(v => v);
            const selectedLabels = selectedValues.map(val => {
              const option = field.options?.find(opt => opt.value === val);
              return option ? option.label : val;
            });
            displayValue = selectedLabels.join(', ');
          } else if (field.type === 'checkbox') {
            displayValue = displayValue === 'true' ? 'Sí' : 'No';
          }
          
          formDataWithLabels[field.label] = displayValue;
        }
      });

      const fecha = format(selectedDate, 'yyyy-MM-dd');
      const fechaDisplay = format(selectedDate, 'dd/MM/yyyy');
      const bookingDetails = {
        date: fechaDisplay,
        time: selectedTime,
        duration: booking.duration,
        bookingName: booking.name,
        ...formDataWithLabels,
      };

      if (booking.use_supabase_backend) {
        // Edge Function path (nuevo backend sin N8N)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-booking`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            booking_id: booking.booking_id,
            fecha,
            hora: selectedTime,
            form_data: formDataWithLabels,
            name: formData.name,
            email: formData.email,
            company: formData.company,
            notes: formData.notes,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error ?? 'Error al crear la cita');
        }

        trackEvent('booking_complete', { date: fecha, time: selectedTime, booking_name: booking.name });
        navigate('/confirmacion', {
          state: {
            webhookResponse: result.data,
            bookingDetails: {
              ...bookingDetails,
              gcal_link: result.data?.gcal_link,
              commercial_name: result.data?.assigned_commercial?.name,
              meeting_link: result.data?.assigned_commercial?.meeting_link,
            },
          },
        });
      }
    } catch (error) {
      console.error('Error submitting booking:', error);
      navigate('/confirmacion', {
        state: {
          bookingDetails: {
            date: selectedDate ? format(selectedDate, 'dd/MM/yyyy') : '',
            time: selectedTime,
            duration: booking?.duration,
            bookingName: booking?.name,
          },
        },
      });
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
      <header className="border-b border-border bg-primary sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
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
                    {/* Dynamic Form Fields */}
                    {getVisibleFields().map((field) => {
                      // Hidden fields
                      if (field.type === 'hidden') {
                        return (
                          <input
                            key={field.id}
                            type="hidden"
                            name={field.id}
                            value={field.defaultValue || ''}
                          />
                        );
                      }

                      return (
                        <div key={field.id} className="space-y-2 animate-fade-in">
                          {/* Label - not for checkbox type */}
                          {field.type !== 'checkbox' && (
                            <Label htmlFor={field.id}>
                              {field.label} {field.required ? '*' : '(opcional)'}
                            </Label>
                          )}
                          
                          {/* Textarea */}
                          {field.type === 'textarea' && (
                            <Textarea
                              id={field.id}
                              value={formData[field.id] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                              placeholder={field.placeholder}
                              className={formErrors[field.id] ? 'border-destructive' : ''}
                              rows={3}
                            />
                          )}
                          
                          {/* Select dropdown */}
                          {field.type === 'select' && (
                            <Select
                              value={formData[field.id] || ''}
                              onValueChange={(value) => setFormData({ ...formData, [field.id]: value })}
                            >
                              <SelectTrigger 
                                id={field.id}
                                className={formErrors[field.id] ? 'border-destructive' : ''}
                              >
                                <SelectValue placeholder={field.placeholder || 'Selecciona una opción'} />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                {(field.options || []).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Radio buttons */}
                          {field.type === 'radio' && (
                            <div className={`space-y-2 ${formErrors[field.id] ? 'text-destructive' : ''}`}>
                              {(field.options || []).map((option) => (
                                <label
                                  key={option.value}
                                  className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                >
                                  <input
                                    type="radio"
                                    name={field.id}
                                    value={option.value}
                                    checked={formData[field.id] === option.value}
                                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                                    className="w-4 h-4 text-primary"
                                  />
                                  <span>{option.label}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {/* Multiselect checkboxes */}
                          {field.type === 'multiselect' && (
                            <div className={`space-y-2 ${formErrors[field.id] ? 'text-destructive' : ''}`}>
                              {(field.options || []).map((option) => {
                                const selectedValues = formData[field.id] ? formData[field.id].split(',') : [];
                                const isChecked = selectedValues.includes(option.value);
                                return (
                                  <label
                                    key={option.value}
                                    className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) => {
                                        let newValues = [...selectedValues];
                                        if (checked) {
                                          newValues.push(option.value);
                                        } else {
                                          newValues = newValues.filter(v => v !== option.value);
                                        }
                                        setFormData({ ...formData, [field.id]: newValues.filter(Boolean).join(',') });
                                      }}
                                    />
                                    <span>{option.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Single checkbox */}
                          {field.type === 'checkbox' && (
                            <div className="flex items-start gap-3 p-3 border border-border rounded-lg">
                              <Checkbox
                                id={field.id}
                                checked={formData[field.id] === 'true'}
                                onCheckedChange={(checked) => 
                                  setFormData({ ...formData, [field.id]: checked ? 'true' : '' })
                                }
                                className={formErrors[field.id] ? 'border-destructive' : ''}
                              />
                              <Label htmlFor={field.id} className="text-sm leading-relaxed cursor-pointer">
                                {field.placeholder || field.label}
                                {field.required && ' *'}
                              </Label>
                            </div>
                          )}

                          {/* Number input */}
                          {field.type === 'number' && (
                            <Input
                              id={field.id}
                              type="number"
                              value={formData[field.id] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                              placeholder={field.placeholder}
                              min={field.min}
                              max={field.max}
                              className={formErrors[field.id] ? 'border-destructive' : ''}
                            />
                          )}

                          {/* Date input */}
                          {field.type === 'date' && (
                            <Input
                              id={field.id}
                              type="date"
                              value={formData[field.id] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                              className={formErrors[field.id] ? 'border-destructive' : ''}
                            />
                          )}

                          {/* URL input */}
                          {field.type === 'url' && (
                            <Input
                              id={field.id}
                              type="url"
                              value={formData[field.id] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                              placeholder={field.placeholder || 'https://...'}
                              className={formErrors[field.id] ? 'border-destructive' : ''}
                            />
                          )}

                          {/* Text, Email, Tel inputs */}
                          {['text', 'email', 'tel'].includes(field.type) && (
                            <Input
                              id={field.id}
                              type={field.type}
                              value={formData[field.id] || ''}
                              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                              placeholder={field.placeholder}
                              className={formErrors[field.id] ? 'border-destructive' : ''}
                            />
                          )}

                          {/* Help text */}
                          {field.helpText && (
                            <p className="text-xs text-muted-foreground">{field.helpText}</p>
                          )}
                          
                          {/* Error message */}
                          {formErrors[field.id] && (
                            <p className="text-sm text-destructive">{formErrors[field.id]}</p>
                          )}
                        </div>
                      );
                    })}

                    {/* Policy Checkbox */}
                    {booking.requirePolicyAcceptance && (
                      <div className="pt-4 border-t border-border">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="policy"
                            checked={acceptedPolicy}
                            onCheckedChange={(checked) => setAcceptedPolicy(checked as boolean)}
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
