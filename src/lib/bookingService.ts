import { supabase } from '@/integrations/supabase/client';
import { BookingConfig, BookingBulletPoint, FormField, TrackingPixel, defaultFormFields } from './types';

// Helper to convert DB row to BookingConfig
const dbToBookingConfig = (row: any): BookingConfig => ({
  booking_id: row.booking_id,
  name: row.name,
  area: row.area || '',
  country: row.country || '',
  title: row.title,
  subtitle: row.subtitle || '',
  duration: row.duration || 30,
  topics: (row.topics as BookingBulletPoint[]) || [],
  targetAudience: (row.target_audience as BookingBulletPoint[]) || [],
  notFor: (row.not_for as BookingBulletPoint[]) || [],
  expectations: (row.expectations as BookingBulletPoint[]) || [],
  policyText: row.policy_text || '',
  requirePolicyAcceptance: row.require_policy_acceptance ?? true,
  formFields: (row.form_fields as FormField[]) || defaultFormFields,
  trackingPixels: (row.tracking_pixels as TrackingPixel[]) || [],
  meeting_link: row.meeting_link ?? null,
  crm_pipeline_id: row.crm_pipeline_id ?? null,
  assignment_type: row.assignment_type ?? 'individual',
  gcal_calendar_id: row.gcal_calendar_id ?? 'primary',
  commercial_group_id: row.commercial_group_id ?? null,
  active: row.active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Helper to convert BookingConfig to DB format
const bookingConfigToDb = (booking: BookingConfig) => ({
  booking_id: booking.booking_id,
  name: booking.name,
  area: booking.area,
  country: booking.country,
  title: booking.title,
  subtitle: booking.subtitle,
  duration: booking.duration,
  topics: JSON.parse(JSON.stringify(booking.topics)),
  target_audience: JSON.parse(JSON.stringify(booking.targetAudience)),
  not_for: JSON.parse(JSON.stringify(booking.notFor)),
  expectations: JSON.parse(JSON.stringify(booking.expectations)),
  policy_text: booking.policyText,
  require_policy_acceptance: booking.requirePolicyAcceptance,
  form_fields: JSON.parse(JSON.stringify(booking.formFields)),
  tracking_pixels: JSON.parse(JSON.stringify(booking.trackingPixels || [])),
  meeting_link: booking.meeting_link ?? null,
  crm_pipeline_id: booking.crm_pipeline_id ?? null,
  assignment_type: booking.assignment_type,
  gcal_calendar_id: booking.gcal_calendar_id,
  commercial_group_id: booking.commercial_group_id,
  active: booking.active,
});

// Fetch all bookings (admin view - includes inactive)
export const fetchAllBookings = async (): Promise<BookingConfig[]> => {
  const { data, error } = await supabase
    .from('booking_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching bookings:', error);
    throw error;
  }

  return (data || []).map(dbToBookingConfig);
};

// Fetch only active bookings (public view)
export const fetchActiveBookings = async (): Promise<BookingConfig[]> => {
  const { data, error } = await supabase
    .from('booking_configs')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching active bookings:', error);
    throw error;
  }

  return (data || []).map(dbToBookingConfig);
};

// Fetch a single booking by ID (public - only active bookings)
export const fetchBookingById = async (bookingId: string): Promise<BookingConfig | null> => {
  const { data, error } = await supabase
    .from('booking_configs')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching booking:', error);
    throw error;
  }

  return data ? dbToBookingConfig(data) : null;
};

// Create a new booking
export const createBookingConfig = async (booking: BookingConfig): Promise<BookingConfig> => {
  const dbData = bookingConfigToDb(booking);
  
  const { data, error } = await supabase
    .from('booking_configs')
    .insert([dbData])
    .select()
    .single();

  if (error) {
    console.error('Error creating booking:', error);
    throw error;
  }

  return dbToBookingConfig(data);
};

// Update an existing booking
export const updateBookingConfig = async (bookingId: string, updates: Partial<BookingConfig>): Promise<BookingConfig> => {
  // Build update object with only provided fields
  const updateData: Record<string, any> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.area !== undefined) updateData.area = updates.area;
  if (updates.country !== undefined) updateData.country = updates.country;
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.subtitle !== undefined) updateData.subtitle = updates.subtitle;
  if (updates.duration !== undefined) updateData.duration = updates.duration;
  if (updates.topics !== undefined) updateData.topics = updates.topics;
  if (updates.targetAudience !== undefined) updateData.target_audience = updates.targetAudience;
  if (updates.notFor !== undefined) updateData.not_for = updates.notFor;
  if (updates.expectations !== undefined) updateData.expectations = updates.expectations;
  if (updates.policyText !== undefined) updateData.policy_text = updates.policyText;
  if (updates.requirePolicyAcceptance !== undefined) updateData.require_policy_acceptance = updates.requirePolicyAcceptance;
  if (updates.formFields !== undefined) updateData.form_fields = updates.formFields;
  if (updates.trackingPixels !== undefined) updateData.tracking_pixels = updates.trackingPixels;
  if (updates.meeting_link !== undefined) updateData.meeting_link = updates.meeting_link;
  if (updates.crm_pipeline_id !== undefined) updateData.crm_pipeline_id = updates.crm_pipeline_id;
  if (updates.assignment_type !== undefined) updateData.assignment_type = updates.assignment_type;
  if (updates.gcal_calendar_id !== undefined) updateData.gcal_calendar_id = updates.gcal_calendar_id;
  if (updates.commercial_group_id !== undefined) updateData.commercial_group_id = updates.commercial_group_id;
  if (updates.active !== undefined) updateData.active = updates.active;

  const { data, error } = await supabase
    .from('booking_configs')
    .update(updateData)
    .eq('booking_id', bookingId)
    .select()
    .single();

  if (error) {
    console.error('Error updating booking:', error);
    throw error;
  }

  return dbToBookingConfig(data);
};

// Delete a booking
export const deleteBookingConfig = async (bookingId: string): Promise<void> => {
  const { error } = await supabase
    .from('booking_configs')
    .delete()
    .eq('booking_id', bookingId);

  if (error) {
    console.error('Error deleting booking:', error);
    throw error;
  }
};

// Toggle booking status
export const toggleBookingConfigStatus = async (bookingId: string): Promise<BookingConfig> => {
  // First get current status
  const current = await fetchBookingById(bookingId);
  if (!current) throw new Error('Booking not found');

  return updateBookingConfig(bookingId, { active: !current.active });
};

// Duplicate a booking with a new ID
export const duplicateBookingConfig = async (original: BookingConfig): Promise<BookingConfig> => {
  const suffix = Date.now().toString(36).slice(-4);
  const newBooking: BookingConfig = {
    ...original,
    booking_id: `${original.booking_id}-${suffix}`,
    name: `Copia de ${original.name}`,
    active: false,
    createdAt: undefined,
    updatedAt: undefined,
  };
  return createBookingConfig(newBooking);
};

// Check if booking_id is unique
export const checkBookingIdUnique = async (bookingId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('booking_configs')
    .select('booking_id')
    .eq('booking_id', bookingId)
    .maybeSingle();

  if (error) {
    console.error('Error checking booking ID:', error);
    return false;
  }

  return data === null;
};
