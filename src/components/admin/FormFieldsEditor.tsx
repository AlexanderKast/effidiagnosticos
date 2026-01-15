import { useState, useRef } from 'react';
import { FormField, FormFieldType, FormFieldOption, FieldCondition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Settings2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldsEditorProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const fieldTypes: { value: FormFieldType; label: string; icon: string; description: string }[] = [
  { value: 'text', label: 'Texto', icon: '📝', description: 'Campo de texto simple' },
  { value: 'email', label: 'Email', icon: '📧', description: 'Valida formato de email' },
  { value: 'tel', label: 'Teléfono', icon: '📱', description: 'Campo para número telefónico' },
  { value: 'number', label: 'Número', icon: '🔢', description: 'Solo números, con min/max' },
  { value: 'url', label: 'URL / Link', icon: '🔗', description: 'Valida formato de URL' },
  { value: 'date', label: 'Fecha', icon: '📅', description: 'Selector de fecha' },
  { value: 'textarea', label: 'Área de texto', icon: '📄', description: 'Texto largo multilínea' },
  { value: 'select', label: 'Desplegable', icon: '📋', description: 'Selección única en lista' },
  { value: 'radio', label: 'Opciones (Radio)', icon: '🔘', description: 'Botones de selección única' },
  { value: 'multiselect', label: 'Selección múltiple', icon: '☑️', description: 'Checkboxes para múltiples opciones' },
  { value: 'checkbox', label: 'Casilla (Sí/No)', icon: '✅', description: 'Un solo checkbox' },
  { value: 'hidden', label: 'Campo oculto', icon: '👁️‍🗨️', description: 'No visible, valor predefinido' },
];

const conditionOperators = [
  { value: 'equals', label: 'Es igual a' },
  { value: 'not_equals', label: 'No es igual a' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_empty', label: 'No está vacío' },
];

// Fields that need options
const fieldsWithOptions: FormFieldType[] = ['select', 'multiselect', 'radio'];

export function FormFieldsEditor({ fields, onChange }: FormFieldsEditorProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragCounter = useRef(0);

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

  const moveField = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= fields.length) return;
    const newFields = [...fields];
    const [movedField] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, movedField);
    onChange(newFields);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      moveField(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    dragCounter.current = 0;
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOverIndex(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Options management for select/radio/multiselect fields
  const addOption = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    const newOption: FormFieldOption = {
      value: generateId(),
      label: 'Nueva opción',
    };
    updateField(fieldId, {
      options: [...(field.options || []), newOption],
    });
  };

  const updateOption = (fieldId: string, optionValue: string, newLabel: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    updateField(fieldId, {
      options: field.options?.map(opt =>
        opt.value === optionValue ? { ...opt, label: newLabel } : opt
      ),
    });
  };

  const removeOption = (fieldId: string, optionValue: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    updateField(fieldId, {
      options: field.options?.filter(opt => opt.value !== optionValue),
    });
  };

  // Condition management
  const toggleCondition = (fieldId: string, enabled: boolean) => {
    if (enabled) {
      const otherFields = fields.filter(f => f.id !== fieldId);
      if (otherFields.length === 0) return;
      updateField(fieldId, {
        condition: {
          fieldId: otherFields[0].id,
          operator: 'not_empty',
        },
      });
    } else {
      updateField(fieldId, { condition: undefined });
    }
  };

  const updateCondition = (fieldId: string, updates: Partial<FieldCondition>) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field || !field.condition) return;
    updateField(fieldId, {
      condition: { ...field.condition, ...updates },
    });
  };

  // Get available fields for condition (fields that come before this one)
  const getAvailableConditionFields = (currentFieldId: string) => {
    const currentIndex = fields.findIndex(f => f.id === currentFieldId);
    return fields.slice(0, currentIndex);
  };

  // Get options for the selected condition field
  const getConditionFieldOptions = (conditionFieldId: string) => {
    const field = fields.find(f => f.id === conditionFieldId);
    return fieldsWithOptions.includes(field?.type || 'text') ? field?.options : undefined;
  };

  const getFieldTypeInfo = (type: FormFieldType) => {
    return fieldTypes.find(t => t.value === type) || fieldTypes[0];
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
        {fields.map((field, index) => {
          const typeInfo = getFieldTypeInfo(field.type);
          return (
            <div
              key={field.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              className={cn(
                "border border-border rounded-lg p-3 bg-card cursor-move transition-all",
                draggedIndex === index && "opacity-50 scale-[0.98]",
                dragOverIndex === index && draggedIndex !== index && "border-primary border-2 bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveField(index, index - 1)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <GripVertical className="w-4 h-4 text-muted-foreground mx-auto" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveField(index, index + 1)}
                    disabled={index === fields.length - 1}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </div>
                
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}
                >
                  <span className="mr-2">{typeInfo.icon}</span>
                  <span className="font-medium">{field.label}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({typeInfo.label})
                    {field.required && ' *'}
                    {field.condition && (
                      <span className="ml-1 text-xs text-primary">(condicional)</span>
                    )}
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
                      <Label htmlFor={`type-${field.id}`}>Tipo de campo</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: FormFieldType) => {
                          const updates: Partial<FormField> = { type: value };
                          // Add default options for fields that need them
                          if (fieldsWithOptions.includes(value) && !field.options?.length) {
                            updates.options = [
                              { value: 'opt1', label: 'Opción 1' },
                              { value: 'opt2', label: 'Opción 2' },
                            ];
                          }
                          updateField(field.id, updates);
                        }}
                      >
                        <SelectTrigger id={`type-${field.id}`} className="bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50 max-h-[300px]">
                          {fieldTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                <div>
                                  <span className="font-medium">{type.label}</span>
                                  <span className="text-xs text-muted-foreground ml-2">{type.description}</span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Placeholder - not for checkbox, radio, multiselect, hidden */}
                  {!['checkbox', 'radio', 'multiselect', 'hidden'].includes(field.type) && (
                    <div className="space-y-2">
                      <Label htmlFor={`placeholder-${field.id}`}>Placeholder</Label>
                      <Input
                        id={`placeholder-${field.id}`}
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        placeholder="Texto de ayuda..."
                      />
                    </div>
                  )}

                  {/* Help text for all fields */}
                  <div className="space-y-2">
                    <Label htmlFor={`helpText-${field.id}`} className="flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      Texto de ayuda (opcional)
                    </Label>
                    <Input
                      id={`helpText-${field.id}`}
                      value={field.helpText || ''}
                      onChange={(e) => updateField(field.id, { helpText: e.target.value })}
                      placeholder="Instrucciones adicionales..."
                    />
                  </div>

                  {/* Number field min/max */}
                  {field.type === 'number' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`min-${field.id}`}>Valor mínimo</Label>
                        <Input
                          id={`min-${field.id}`}
                          type="number"
                          value={field.min ?? ''}
                          onChange={(e) => updateField(field.id, { min: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="Sin límite"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`max-${field.id}`}>Valor máximo</Label>
                        <Input
                          id={`max-${field.id}`}
                          type="number"
                          value={field.max ?? ''}
                          onChange={(e) => updateField(field.id, { max: e.target.value ? Number(e.target.value) : undefined })}
                          placeholder="Sin límite"
                        />
                      </div>
                    </div>
                  )}

                  {/* Hidden field default value */}
                  {field.type === 'hidden' && (
                    <div className="space-y-2">
                      <Label htmlFor={`defaultValue-${field.id}`}>Valor predefinido</Label>
                      <Input
                        id={`defaultValue-${field.id}`}
                        value={field.defaultValue || ''}
                        onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                        placeholder="Valor que se enviará..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Este valor se enviará automáticamente con el formulario
                      </p>
                    </div>
                  )}

                  {/* Checkbox label text */}
                  {field.type === 'checkbox' && (
                    <div className="space-y-2">
                      <Label htmlFor={`placeholder-${field.id}`}>Texto junto al checkbox</Label>
                      <Textarea
                        id={`placeholder-${field.id}`}
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        placeholder="Acepto los términos y condiciones..."
                        rows={2}
                      />
                    </div>
                  )}

                  {/* Options Editor for select/radio/multiselect */}
                  {fieldsWithOptions.includes(field.type) && (
                    <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label>
                          {field.type === 'radio' ? 'Opciones (Radio buttons)' : 
                           field.type === 'multiselect' ? 'Opciones (Checkboxes)' :
                           'Opciones del desplegable'}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addOption(field.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Agregar
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {(field.options || []).map((option) => (
                          <div key={option.value} className="flex items-center gap-2">
                            <Input
                              value={option.label}
                              onChange={(e) => updateOption(field.id, option.value, e.target.value)}
                              placeholder="Texto de la opción"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeOption(field.id, option.value)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        {(!field.options || field.options.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            No hay opciones configuradas
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Required toggle - not for hidden fields */}
                  {field.type !== 'hidden' && (
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
                  )}

                  {/* Conditional Logic - not for first field or hidden fields */}
                  {index > 0 && field.type !== 'hidden' && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Settings2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <Label>Lógica condicional</Label>
                            <p className="text-xs text-muted-foreground">
                              Mostrar solo si se cumple una condición
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={!!field.condition}
                          onCheckedChange={(checked) => toggleCondition(field.id, checked)}
                        />
                      </div>

                      {field.condition && (
                        <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                          <p className="text-sm font-medium">Mostrar este campo cuando:</p>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {/* Field selector */}
                            <Select
                              value={field.condition.fieldId}
                              onValueChange={(value) => updateCondition(field.id, { fieldId: value, value: undefined })}
                            >
                              <SelectTrigger className="bg-card">
                                <SelectValue placeholder="Campo" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                {getAvailableConditionFields(field.id).map((f) => (
                                  <SelectItem key={f.id} value={f.id}>
                                    {f.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Operator selector */}
                            <Select
                              value={field.condition.operator}
                              onValueChange={(value: FieldCondition['operator']) => 
                                updateCondition(field.id, { operator: value })
                              }
                            >
                              <SelectTrigger className="bg-card">
                                <SelectValue placeholder="Condición" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                {conditionOperators.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Value input */}
                            {field.condition.operator !== 'not_empty' && (
                              <>
                                {getConditionFieldOptions(field.condition.fieldId) ? (
                                  <Select
                                    value={field.condition.value || ''}
                                    onValueChange={(value) => updateCondition(field.id, { value })}
                                  >
                                    <SelectTrigger className="bg-card">
                                      <SelectValue placeholder="Valor" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover z-50">
                                      {getConditionFieldOptions(field.condition.fieldId)?.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    value={field.condition.value || ''}
                                    onChange={(e) => updateCondition(field.id, { value: e.target.value })}
                                    placeholder="Valor"
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

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