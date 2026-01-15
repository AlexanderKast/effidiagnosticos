-- Add form_fields column to booking_configs to allow customizable form fields
ALTER TABLE public.booking_configs 
ADD COLUMN form_fields jsonb NOT NULL DEFAULT '[
  {"id": "name", "label": "Nombre completo", "type": "text", "required": true, "placeholder": "Tu nombre"},
  {"id": "email", "label": "Email", "type": "email", "required": true, "placeholder": "tu@email.com"},
  {"id": "company", "label": "Empresa", "type": "text", "required": false, "placeholder": "Nombre de tu empresa"},
  {"id": "notes", "label": "Notas adicionales", "type": "textarea", "required": false, "placeholder": "¿Algo que debamos saber antes de la reunión?"}
]'::jsonb;