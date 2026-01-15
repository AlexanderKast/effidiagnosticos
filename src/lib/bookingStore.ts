import { BookingConfig, demoBookings } from './types';

const STORAGE_KEY = 'efficommerce_bookings';

// Load bookings from localStorage or use demo data
export const loadBookings = (): BookingConfig[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading bookings:', error);
  }
  // Initialize with demo data
  saveBookings(demoBookings);
  return demoBookings;
};

// Save bookings to localStorage
export const saveBookings = (bookings: BookingConfig[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  } catch (error) {
    console.error('Error saving bookings:', error);
  }
};

// Get a single booking by ID
export const getBookingById = (bookingId: string): BookingConfig | undefined => {
  const bookings = loadBookings();
  return bookings.find((b) => b.booking_id === bookingId);
};

// Create a new booking
export const createBooking = (booking: BookingConfig): BookingConfig => {
  const bookings = loadBookings();
  const newBooking = {
    ...booking,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  bookings.push(newBooking);
  saveBookings(bookings);
  return newBooking;
};

// Update an existing booking
export const updateBooking = (bookingId: string, updates: Partial<BookingConfig>): BookingConfig | null => {
  const bookings = loadBookings();
  const index = bookings.findIndex((b) => b.booking_id === bookingId);
  
  if (index === -1) return null;
  
  bookings[index] = {
    ...bookings[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  saveBookings(bookings);
  return bookings[index];
};

// Delete a booking
export const deleteBooking = (bookingId: string): boolean => {
  const bookings = loadBookings();
  const filtered = bookings.filter((b) => b.booking_id !== bookingId);
  
  if (filtered.length === bookings.length) return false;
  
  saveBookings(filtered);
  return true;
};

// Toggle booking active status
export const toggleBookingStatus = (bookingId: string): BookingConfig | null => {
  const bookings = loadBookings();
  const booking = bookings.find((b) => b.booking_id === bookingId);
  
  if (!booking) return null;
  
  return updateBooking(bookingId, { active: !booking.active });
};

// Check if booking_id is unique
export const isBookingIdUnique = (bookingId: string, excludeId?: string): boolean => {
  const bookings = loadBookings();
  return !bookings.some((b) => b.booking_id === bookingId && b.booking_id !== excludeId);
};

// Generate slug from name
export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
