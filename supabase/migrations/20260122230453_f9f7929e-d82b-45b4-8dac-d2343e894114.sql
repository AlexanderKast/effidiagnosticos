-- Add tracking_pixels column to booking_configs table
ALTER TABLE public.booking_configs 
ADD COLUMN IF NOT EXISTS tracking_pixels JSONB DEFAULT '[]'::jsonb;

-- Add comment to document the structure
COMMENT ON COLUMN public.booking_configs.tracking_pixels IS 'Array of tracking pixel configurations: [{platform, pixelId, events: [{eventName, triggerOn}]}]';