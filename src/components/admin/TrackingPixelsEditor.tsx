import { useState } from 'react';
import { 
  TrackingPixel, 
  PixelEvent, 
  PixelPlatform, 
  PixelTrigger,
  PIXEL_PLATFORMS, 
  PIXEL_TRIGGERS, 
  STANDARD_EVENTS 
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Plus, Trash2, Activity, BarChart3, Target } from 'lucide-react';

interface TrackingPixelsEditorProps {
  pixels: TrackingPixel[];
  onChange: (pixels: TrackingPixel[]) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export function TrackingPixelsEditor({ pixels, onChange }: TrackingPixelsEditorProps) {
  const [expandedPixel, setExpandedPixel] = useState<string | undefined>();

  const addPixel = () => {
    const newPixel: TrackingPixel = {
      id: generateId(),
      platform: 'facebook',
      pixelId: '',
      enabled: true,
      events: [],
    };
    onChange([...pixels, newPixel]);
    setExpandedPixel(newPixel.id);
  };

  const updatePixel = (id: string, updates: Partial<TrackingPixel>) => {
    onChange(pixels.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removePixel = (id: string) => {
    onChange(pixels.filter(p => p.id !== id));
  };

  const addEvent = (pixelId: string) => {
    const pixel = pixels.find(p => p.id === pixelId);
    if (!pixel) return;

    const defaultEvent = STANDARD_EVENTS[pixel.platform][0] || 'custom_event';
    const newEvent: PixelEvent = {
      id: generateId(),
      eventName: defaultEvent,
      triggerOn: 'booking_complete',
    };

    updatePixel(pixelId, { 
      events: [...pixel.events, newEvent] 
    });
  };

  const updateEvent = (pixelId: string, eventId: string, updates: Partial<PixelEvent>) => {
    const pixel = pixels.find(p => p.id === pixelId);
    if (!pixel) return;

    updatePixel(pixelId, {
      events: pixel.events.map(e => e.id === eventId ? { ...e, ...updates } : e)
    });
  };

  const removeEvent = (pixelId: string, eventId: string) => {
    const pixel = pixels.find(p => p.id === pixelId);
    if (!pixel) return;

    updatePixel(pixelId, {
      events: pixel.events.filter(e => e.id !== eventId)
    });
  };

  const getPlatformIcon = (platform: PixelPlatform) => {
    switch (platform) {
      case 'facebook': return '📘';
      case 'google_analytics': return '📊';
      case 'google_ads': return '🎯';
      case 'tiktok': return '🎵';
      case 'linkedin': return '💼';
      case 'twitter': return '🐦';
      default: return '📡';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Píxeles de Seguimiento</h3>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPixel}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar Pixel
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Configura píxeles para medir conversiones y optimizar tus campañas de publicidad.
      </p>

      {pixels.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No hay píxeles configurados</p>
          <Button type="button" variant="link" size="sm" onClick={addPixel}>
            Agregar tu primer pixel
          </Button>
        </div>
      ) : (
        <Accordion 
          type="single" 
          collapsible 
          value={expandedPixel}
          onValueChange={setExpandedPixel}
          className="space-y-2"
        >
          {pixels.map((pixel) => (
            <AccordionItem 
              key={pixel.id} 
              value={pixel.id}
              className="border rounded-lg px-4 bg-card"
            >
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-xl">{getPlatformIcon(pixel.platform)}</span>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {PIXEL_PLATFORMS[pixel.platform].name}
                      </span>
                      {!pixel.enabled && (
                        <Badge variant="secondary" className="text-xs">Desactivado</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {pixel.pixelId || 'Sin ID configurado'} • {pixel.events.length} evento(s)
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="pb-4 space-y-4">
                {/* Pixel Settings */}
                <div className="grid gap-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Estado del pixel</Label>
                      <p className="text-xs text-muted-foreground">
                        {pixel.enabled ? 'Activo y disparando eventos' : 'Pausado'}
                      </p>
                    </div>
                    <Switch
                      checked={pixel.enabled}
                      onCheckedChange={(enabled) => updatePixel(pixel.id, { enabled })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plataforma</Label>
                      <Select
                        value={pixel.platform}
                        onValueChange={(platform: PixelPlatform) => updatePixel(pixel.id, { platform })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PIXEL_PLATFORMS) as PixelPlatform[]).map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              {getPlatformIcon(platform)} {PIXEL_PLATFORMS[platform].name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{PIXEL_PLATFORMS[pixel.platform].idLabel}</Label>
                      <Input
                        value={pixel.pixelId}
                        onChange={(e) => updatePixel(pixel.id, { pixelId: e.target.value })}
                        placeholder={PIXEL_PLATFORMS[pixel.platform].placeholder}
                      />
                    </div>
                  </div>
                </div>

                {/* Events Section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      <Label>Eventos de Conversión</Label>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => addEvent(pixel.id)}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Evento
                    </Button>
                  </div>

                  {pixel.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay eventos configurados. Agrega eventos para medir conversiones.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pixel.events.map((event) => (
                        <div 
                          key={event.id} 
                          className="bg-muted/50 rounded-lg p-3 space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Nombre del evento</Label>
                              <Select
                                value={event.eventName}
                                onValueChange={(eventName) => updateEvent(pixel.id, event.id, { eventName })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STANDARD_EVENTS[pixel.platform].map((eventName) => (
                                    <SelectItem key={eventName} value={eventName}>
                                      {eventName}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="custom">Personalizado...</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Disparar cuando</Label>
                              <Select
                                value={event.triggerOn}
                                onValueChange={(triggerOn: PixelTrigger) => updateEvent(pixel.id, event.id, { triggerOn })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(PIXEL_TRIGGERS) as PixelTrigger[]).map((trigger) => (
                                    <SelectItem key={trigger} value={trigger}>
                                      {PIXEL_TRIGGERS[trigger].name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {event.eventName === 'custom' && (
                            <Input
                              placeholder="Nombre del evento personalizado"
                              value={event.customParameters?.customEventName || ''}
                              onChange={(e) => updateEvent(pixel.id, event.id, { 
                                customParameters: { 
                                  ...event.customParameters, 
                                  customEventName: e.target.value 
                                } 
                              })}
                              className="h-9"
                            />
                          )}

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {PIXEL_TRIGGERS[event.triggerOn].description}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEvent(pixel.id, event.id)}
                              className="h-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete Pixel */}
                <div className="border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removePixel(pixel.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar Pixel
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
