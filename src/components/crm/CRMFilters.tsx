import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CRM_ESTADOS } from '@/lib/crmUtils';
import { CRMFilters as Filters } from '@/lib/crmService';

interface CRMFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  total: number;
}

export function CRMFilters({ filters, onChange, total }: CRMFiltersProps) {
  const hasFilters = filters.estado || filters.soloVentas || filters.search;

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          className="pl-9"
        />
      </div>

      <Select
        value={filters.estado ?? 'todos'}
        onValueChange={(v) => onChange({ ...filters, estado: v === 'todos' ? undefined : v })}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Todos los estados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {CRM_ESTADOS.map((e) => (
            <SelectItem key={e} value={e}>{e}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant={filters.soloVentas ? 'default' : 'outline'}
        size="sm"
        onClick={() => onChange({ ...filters, soloVentas: !filters.soloVentas || undefined })}
      >
        Solo ventas
      </Button>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({})}
          className="text-muted-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Limpiar
        </Button>
      )}

      <span className="text-sm text-muted-foreground whitespace-nowrap ml-auto">
        {total} registro{total !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
