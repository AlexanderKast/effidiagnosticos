import { useState } from 'react';
import { defaultServices, ServiceConfig } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Settings, ExternalLink, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceConfig[]>(defaultServices);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleService = (serviceId: string) => {
    setServices((prev) =>
      prev.map((s) =>
        s.service_id === serviceId ? { ...s, active: !s.active } : s
      )
    );
  };

  const updateDuration = (serviceId: string, duration: number) => {
    setServices((prev) =>
      prev.map((s) =>
        s.service_id === serviceId ? { ...s, duration } : s
      )
    );
  };

  const copyLink = (serviceId: string) => {
    const url = `${window.location.origin}/agenda/${serviceId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(serviceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openLink = (serviceId: string) => {
    navigate(`/agenda/${serviceId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Panel de Configuración</h1>
              <p className="text-sm text-muted-foreground">Efficommerce Scheduling</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Services Table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Servicios de Agenda</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configura los links de agendamiento para cada servicio
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>País</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.service_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{service.name}</p>
                      <p className="text-sm text-muted-foreground">{service.service_id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{service.area}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {service.country}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={service.duration}
                        onChange={(e) =>
                          updateDuration(service.service_id, parseInt(e.target.value) || 30)
                        }
                        className="w-20 h-8"
                        min={15}
                        max={120}
                        step={15}
                      />
                      <span className="text-sm text-muted-foreground">min</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={service.active}
                        onCheckedChange={() => toggleService(service.service_id)}
                      />
                      <span className={service.active ? 'text-success' : 'text-muted-foreground'}>
                        {service.active ? 'Activo' : 'Pausado'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyLink(service.service_id)}
                        className="h-8 w-8"
                      >
                        {copiedId === service.service_id ? (
                          <Check className="w-4 h-4 text-success" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openLink(service.service_id)}
                        className="h-8 w-8"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Info Section */}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2">URLs de Webhook</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configura estas variables de entorno para conectar con n8n:
            </p>
            <div className="space-y-2 font-mono text-sm">
              <p className="text-muted-foreground">
                VITE_N8N_GET_AVAILABILITY_URL
              </p>
              <p className="text-muted-foreground">
                VITE_N8N_CREATE_BOOKING_URL
              </p>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-2">Estructura de URLs</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Los links de agenda siguen este formato:
            </p>
            <div className="space-y-1 font-mono text-sm text-primary">
              <p>/agenda/ventas-colombia</p>
              <p>/agenda/onboarding-mexico</p>
              <p>/agenda/soporte-latam</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
