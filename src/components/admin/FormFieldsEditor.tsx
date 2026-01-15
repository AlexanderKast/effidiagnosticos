import { useState } from 'react';
import { FormField, FormFieldType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical } from 'lucide-react';

interface FormFieldsEditorProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const fieldTypes: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Teléfono' },
  { value: 'textarea', label: 'Área de texto' },
];

export function FormFieldsEditor({ fields, onChange }: FormFieldsEditorProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const addField = () => {
    const newField: FormField = {
      id: generateId(),
      label: 'Nuevo campo',
      type: 'text',
      required: false,
      placeholder: '',
    };
    onChange([...fields, newField]);
    setExpandedField(newField.id);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    onChange(
      fields.map((field) =>
        field.id === id ? { ...field, ...updates } : field
      )
    );
  };

  const removeField = (id: string) => {
    onChange(fields.filter((field) => field.id !== id));
    if (expandedField === id) {
      setExpandedField(null);
    }
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    onChange(newFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Campos del formulario</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar campo
        </Button>
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="border border-border rounded-lg p-3 bg-card"
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveField(index, 'up')}
                  disabled={index === 0}
                >
                  <GripVertical className="w-3 h-3" />
                </Button>
              </div>
              
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}
              >
                <span className="font-medium">{field.label}</span>
                <span className="text-sm text-muted-foreground ml-2">
                  ({fieldTypes.find(t => t.value === field.type)?.label})
                  {field.required && ' *'}
                </span>
              </button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeField(field.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {expandedField === field.id && (
              <div className="mt-4 pt-4 border-t border-border space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`label-${field.id}`}>Etiqueta</Label>
                    <Input
                      id={`label-${field.id}`}
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Nombre del campo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`type-${field.id}`}>Tipo</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value: FormFieldType) => updateField(field.id, { type: value })}
                    >
                      <SelectTrigger id={`type-${field.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`placeholder-${field.id}`}>Placeholder</Label>
                  <Input
                    id={`placeholder-${field.id}`}
                    value={field.placeholder || ''}
                    onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                    placeholder="Texto de ayuda..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Campo requerido</Label>
                    <p className="text-xs text-muted-foreground">
                      El usuario debe completarlo
                    </p>
                  </div>
                  <Switch
                    checked={field.required}
                    onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {fields.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
            No hay campos configurados
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Arrastra los campos para reordenarlos. Los campos marcados con * son obligatorios.
      </p>
    </div>
  );
}