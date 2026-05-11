// Types for the booking system

export interface BookingBulletPoint {
  id: string;
  text: string;
}

// Tracking Pixel Types
export type PixelPlatform = 'facebook' | 'google_analytics' | 'google_ads' | 'tiktok' | 'linkedin' | 'twitter' | 'custom';

export type PixelTrigger = 'page_view' | 'start_booking' | 'select_date' | 'select_time' | 'form_submit' | 'booking_complete';

export interface PixelEvent {
  id: string;
  eventName: string;        // The event name to send (e.g., "Lead", "Schedule", "CompleteRegistration")
  triggerOn: PixelTrigger;  // When to fire this event
  customParameters?: Record<string, string>; // Additional parameters to send
}

export interface TrackingPixel {
  id: string;
  platform: PixelPlatform;
  pixelId: string;          // The pixel/measurement ID
  enabled: boolean;
  events: PixelEvent[];
}

// Platform display info
export const PIXEL_PLATFORMS: Record<PixelPlatform, { name: string; idLabel: string; placeholder: string }> = {
  facebook: { name: 'Facebook Pixel', idLabel: 'Pixel ID', placeholder: 'Ej: 123456789012345' },
  google_analytics: { name: 'Google Analytics 4', idLabel: 'Measurement ID', placeholder: 'Ej: G-XXXXXXXXXX' },
  google_ads: { name: 'Google Ads', idLabel: 'Conversion ID', placeholder: 'Ej: AW-123456789' },
  tiktok: { name: 'TikTok Pixel', idLabel: 'Pixel ID', placeholder: 'Ej: XXXXXXXXXXXXXXXXX' },
  linkedin: { name: 'LinkedIn Insight Tag', idLabel: 'Partner ID', placeholder: 'Ej: 123456' },
  twitter: { name: 'Twitter Pixel', idLabel: 'Pixel ID', placeholder: 'Ej: xxxxx' },
  custom: { name: 'Pixel Personalizado', idLabel: 'ID', placeholder: 'ID del pixel' },
};

export const PIXEL_TRIGGERS: Record<PixelTrigger, { name: string; description: string }> = {
  page_view: { name: 'Vista de página', description: 'Cuando el usuario abre la página de booking' },
  start_booking: { name: 'Inicio de reserva', description: 'Cuando el usuario empieza el proceso' },
  select_date: { name: 'Selección de fecha', description: 'Cuando selecciona una fecha' },
  select_time: { name: 'Selección de hora', description: 'Cuando selecciona un horario' },
  form_submit: { name: 'Envío de formulario', description: 'Cuando envía el formulario final' },
  booking_complete: { name: 'Reserva completada', description: 'Cuando se confirma la reserva' },
};

// Standard events per platform
export const STANDARD_EVENTS: Record<PixelPlatform, string[]> = {
  facebook: ['PageView', 'Lead', 'Schedule', 'CompleteRegistration', 'Contact', 'SubmitApplication', 'ViewContent'],
  google_analytics: ['page_view', 'generate_lead', 'sign_up', 'begin_checkout', 'purchase', 'view_item'],
  google_ads: ['conversion', 'page_view', 'submit_lead_form'],
  tiktok: ['PageView', 'ClickButton', 'SubmitForm', 'CompleteRegistration', 'Contact', 'Schedule'],
  linkedin: ['conversion', 'page_view'],
  twitter: ['PageView', 'Lead', 'SignUp', 'Purchase'],
  custom: ['custom_event'],
};

// Form field types
export type FormFieldType = 
  | 'text' 
  | 'email' 
  | 'textarea' 
  | 'tel' 
  | 'select'
  | 'multiselect'    // Multiple selection checkboxes
  | 'radio'          // Radio buttons (single selection)
  | 'checkbox'       // Single checkbox (yes/no)
  | 'number'         // Numeric input
  | 'date'           // Date picker
  | 'url'            // URL input
  | 'hidden';        // Hidden field with default value

export interface FormFieldOption {
  value: string;
  label: string;
}

// Conditional logic for showing/hiding fields
export interface FieldCondition {
  fieldId: string;      // Which field to check
  operator: 'equals' | 'not_equals' | 'contains' | 'not_empty';
  value?: string;       // Value to compare (not needed for not_empty)
}

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: FormFieldOption[];     // For select, multiselect, radio fields
  condition?: FieldCondition;      // Show field only if condition is met
  defaultValue?: string;           // Default value (useful for hidden fields)
  min?: number;                    // For number fields
  max?: number;                    // For number fields
  helpText?: string;               // Help text shown below the field
}

export interface BookingConfig {
  // Identity
  booking_id: string;
  name: string;
  area: string;
  country: string;

  // Landing content
  title: string;
  subtitle: string;
  duration: number; // minutes
  
  // What will be covered
  topics: BookingBulletPoint[];
  
  // Who is it for / not for
  targetAudience: BookingBulletPoint[];
  notFor: BookingBulletPoint[];
  
  // Expectations
  expectations: BookingBulletPoint[];
  
  // Policies
  policyText: string;
  requirePolicyAcceptance: boolean;

  // Form fields
  formFields: FormField[];

  // Tracking pixels
  trackingPixels: TrackingPixel[];

  // Backend config
  use_supabase_backend: boolean;

  // Status
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingFormData {
  [key: string]: string | boolean;
  acceptedPolicy: boolean;
}

export interface AvailabilityRequest {
  booking_id: string;
  date: string;
}

export interface BookingRequest {
  booking_id: string;
  name: string;
  email: string;
  date: string;
  time: string;
  company?: string;
  notes?: string;
}

// Default form fields
export const defaultFormFields: FormField[] = [
  { id: 'name', label: 'Nombre completo', type: 'text', required: true, placeholder: 'Tu nombre' },
  { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'tu@email.com' },
  { id: 'company', label: 'Empresa', type: 'text', required: false, placeholder: 'Nombre de tu empresa' },
  { id: 'notes', label: 'Notas adicionales', type: 'textarea', required: false, placeholder: '¿Algo que debamos saber antes de la reunión?' },
];

// Default booking template
export const createDefaultBooking = (partial?: Partial<BookingConfig>): BookingConfig => ({
  booking_id: '',
  name: '',
  area: '',
  country: '',
  title: '¿Listo para transformar tu negocio?',
  subtitle: 'Agenda una sesión personalizada con nuestro equipo de expertos.',
  duration: 30,
  topics: [
    { id: '1', text: 'Análisis de tu situación actual' },
    { id: '2', text: 'Identificación de oportunidades' },
    { id: '3', text: 'Plan de acción personalizado' },
  ],
  targetAudience: [
    { id: '1', text: 'Empresas que buscan escalar sus operaciones' },
    { id: '2', text: 'Equipos que necesitan optimizar procesos' },
  ],
  notFor: [
    { id: '1', text: 'Personas buscando empleo' },
    { id: '2', text: 'Consultas generales sin objetivo definido' },
  ],
  expectations: [
    { id: '1', text: 'Llegar puntual a la videollamada' },
    { id: '2', text: 'Tener conexión estable de internet' },
    { id: '3', text: 'Venir con un objetivo claro para la sesión' },
    { id: '4', text: 'Cancelar con al menos 24 horas de anticipación' },
  ],
  policyText: 'Tus datos serán tratados de forma confidencial y solo se utilizarán para coordinar esta reunión. Recibirás el link de Zoom y la invitación de calendario por correo electrónico.',
  requirePolicyAcceptance: true,
  formFields: defaultFormFields,
  trackingPixels: [],
  use_supabase_backend: true,
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...partial,
});

// Demo bookings
export const demoBookings: BookingConfig[] = [
  createDefaultBooking({
    booking_id: 'ventas-colombia',
    name: 'Consultoría de Ventas',
    area: 'Ventas',
    country: 'Colombia',
    title: 'Potencia tu estrategia de ventas',
    subtitle: 'Una sesión de 30 minutos para analizar tu funnel y encontrar oportunidades de crecimiento.',
    duration: 30,
    topics: [
      { id: '1', text: 'Revisión de tu proceso de ventas actual' },
      { id: '2', text: 'Análisis de métricas clave' },
      { id: '3', text: 'Recomendaciones personalizadas' },
    ],
    active: true,
  }),
  createDefaultBooking({
    booking_id: 'onboarding-latam',
    name: 'Onboarding Inicial',
    area: 'Onboarding',
    country: 'LATAM',
    title: 'Bienvenido a Efficommerce',
    subtitle: 'Tu sesión de onboarding para comenzar con el pie derecho.',
    duration: 45,
    topics: [
      { id: '1', text: 'Configuración inicial de tu cuenta' },
      { id: '2', text: 'Tour por la plataforma' },
      { id: '3', text: 'Primeros pasos y mejores prácticas' },
    ],
    active: true,
  }),
  createDefaultBooking({
    booking_id: 'soporte-mx',
    name: 'Soporte Técnico',
    area: 'Soporte',
    country: 'México',
    title: '¿Necesitas ayuda técnica?',
    subtitle: 'Resuelve tus dudas técnicas con nuestro equipo especializado.',
    duration: 30,
    topics: [
      { id: '1', text: 'Diagnóstico del problema' },
      { id: '2', text: 'Solución en tiempo real' },
      { id: '3', text: 'Documentación de la resolución' },
    ],
    active: true,
  }),
];
