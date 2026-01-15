// Environment configuration for n8n webhooks
// These can be overridden via environment variables

export const config = {
  // n8n webhook URLs - configure these in your environment
  N8N_GET_AVAILABILITY_URL: import.meta.env.VITE_N8N_GET_AVAILABILITY_URL || '/api/availability',
  N8N_CREATE_BOOKING_URL: import.meta.env.VITE_N8N_CREATE_BOOKING_URL || '/api/booking',
};

// Service configuration type
export interface ServiceConfig {
  service_id: string;
  name: string;
  area: string;
  country: string;
  duration: number; // in minutes
  active: boolean;
}

// Mock services for demo - in production, fetch from n8n or database
export const defaultServices: ServiceConfig[] = [
  {
    service_id: 'ventas-colombia',
    name: 'Consulta de Ventas',
    area: 'Ventas',
    country: 'Colombia',
    duration: 30,
    active: true,
  },
  {
    service_id: 'onboarding-mexico',
    name: 'Onboarding Inicial',
    area: 'Onboarding',
    country: 'México',
    duration: 45,
    active: true,
  },
  {
    service_id: 'soporte-latam',
    name: 'Soporte Técnico',
    area: 'Soporte',
    country: 'LATAM',
    duration: 30,
    active: true,
  },
];
