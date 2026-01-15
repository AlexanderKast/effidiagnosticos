// Types for the booking system

export interface BookingBulletPoint {
  id: string;
  text: string;
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

  // Technical config (per booking)
  n8n_get_availability_url: string;
  n8n_create_booking_url: string;

  // Status
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookingFormData {
  name: string;
  email: string;
  company?: string;
  notes?: string;
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
  n8n_get_availability_url: '',
  n8n_create_booking_url: '',
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
