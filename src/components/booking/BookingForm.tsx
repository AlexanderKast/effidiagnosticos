import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { BookingFormData } from '@/lib/types';

interface BookingFormProps {
  policyText: string;
  onSubmit: (data: BookingFormData) => void;
  isSubmitting: boolean;
  isDisabled: boolean;
}

export function BookingForm({ policyText, onSubmit, isSubmitting, isDisabled }: BookingFormProps) {
  const [formData, setFormData] = useState<BookingFormData>({
    name: '',
    email: '',
    company: '',
    notes: '',
    acceptedPolicy: false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof BookingFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Ingresa un email válido';
    }

    if (!formData.acceptedPolicy) {
      newErrors.acceptedPolicy = 'Debes aceptar la política de datos';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateField = (field: keyof BookingFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in space-y-6">
      <h2 className="text-xl font-semibold text-foreground mb-6">
        Completa tus datos
      </h2>

      {/* Name Field */}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre completo *</Label>
        <Input
          id="name"
          type="text"
          placeholder="Tu nombre"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          className={errors.email ? 'border-destructive' : ''}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>

      {/* Company Field (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="company">Empresa (opcional)</Label>
        <Input
          id="company"
          type="text"
          placeholder="Nombre de tu empresa"
          value={formData.company}
          onChange={(e) => updateField('company', e.target.value)}
        />
      </div>

      {/* Notes Field (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notas adicionales (opcional)</Label>
        <Textarea
          id="notes"
          placeholder="¿Hay algo que debamos saber antes de la reunión?"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={3}
        />
      </div>

      {/* Policy Checkbox */}
      <div className="space-y-2">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="policy"
            checked={formData.acceptedPolicy}
            onCheckedChange={(checked) => updateField('acceptedPolicy', !!checked)}
            className={errors.acceptedPolicy ? 'border-destructive' : ''}
          />
          <Label htmlFor="policy" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
            {policyText}
          </Label>
        </div>
        {errors.acceptedPolicy && (
          <p className="text-sm text-destructive">{errors.acceptedPolicy}</p>
        )}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isDisabled || isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Agendando...
          </>
        ) : (
          'Agendar reunión'
        )}
      </Button>

      {isDisabled && (
        <p className="text-sm text-muted-foreground text-center">
          Selecciona una fecha y hora para continuar
        </p>
      )}
    </form>
  );
}
