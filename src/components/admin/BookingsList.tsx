import { BookingConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalLink, Copy, Check, MoreVertical, Pencil, Trash2, Clock, MapPin, BarChart2, CopyPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface BookingsListProps {
  bookings: BookingConfig[];
  onEdit: (booking: BookingConfig) => void;
  onDelete: (bookingId: string) => void;
  onToggleStatus: (bookingId: string) => void;
  onDuplicate: (booking: BookingConfig) => void;
}

export function BookingsList({ bookings, onEdit, onDelete, onToggleStatus, onDuplicate }: BookingsListProps) {
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = (bookingId: string) => {
    const url = `${window.location.origin}/booking/${bookingId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(bookingId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openLink = (bookingId: string) => {
    window.open(`/booking/${bookingId}`, '_blank');
  };

  if (bookings.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
        <p className="text-muted-foreground mb-2">No hay bookings creados todavía</p>
        <p className="text-sm text-muted-foreground">
          Crea tu primer link de booking para comenzar
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Detalles</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.booking_id}>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">{booking.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    /booking/{booking.booking_id}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant="secondary">{booking.area || 'Sin área'}</Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {booking.country || 'Global'}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {booking.duration} min
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={booking.active}
                    onCheckedChange={() => onToggleStatus(booking.booking_id)}
                  />
                  <span className={booking.active ? 'text-success text-sm' : 'text-muted-foreground text-sm'}>
                    {booking.active ? 'Activo' : 'Pausado'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyLink(booking.booking_id)}
                    className="h-8 w-8"
                    title="Copiar link"
                  >
                    {copiedId === booking.booking_id ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openLink(booking.booking_id)}
                    className="h-8 w-8"
                    title="Abrir link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/crm/${booking.booking_id}`)}
                    className="h-8 w-8"
                    title="Ver CRM"
                  >
                    <BarChart2 className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(booking)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(booking)}>
                        <CopyPlus className="w-4 h-4 mr-2" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(booking.booking_id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
