import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PHONE_COUNTRIES = [
  { code: 'CO', flag: '🇨🇴', name: 'Colombia',          dial: '+57'  },
  { code: 'GT', flag: '🇬🇹', name: 'Guatemala',         dial: '+502' },
  { code: 'CR', flag: '🇨🇷', name: 'Costa Rica',        dial: '+506' },
  { code: 'DO', flag: '🇩🇴', name: 'Rep. Dominicana',   dial: '+1'   },
  { code: 'EC', flag: '🇪🇨', name: 'Ecuador',           dial: '+593' },
  { code: 'MX', flag: '🇲🇽', name: 'México',            dial: '+52'  },
  { code: 'PE', flag: '🇵🇪', name: 'Perú',              dial: '+51'  },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina',         dial: '+54'  },
  { code: 'CL', flag: '🇨🇱', name: 'Chile',             dial: '+56'  },
  { code: 'VE', flag: '🇻🇪', name: 'Venezuela',         dial: '+58'  },
  { code: 'PA', flag: '🇵🇦', name: 'Panamá',            dial: '+507' },
  { code: 'HN', flag: '🇭🇳', name: 'Honduras',          dial: '+504' },
  { code: 'BO', flag: '🇧🇴', name: 'Bolivia',           dial: '+591' },
  { code: 'PY', flag: '🇵🇾', name: 'Paraguay',          dial: '+595' },
  { code: 'UY', flag: '🇺🇾', name: 'Uruguay',          dial: '+598' },
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos',    dial: '+1'   },
  { code: 'ES', flag: '🇪🇸', name: 'España',            dial: '+34'  },
] as const;

export type PhoneCountry = typeof PHONE_COUNTRIES[number];

function parseFullNumber(value: string): { countryCode: string; local: string } {
  if (!value) return { countryCode: 'CO', local: '' };
  if (!value.startsWith('+')) return { countryCode: 'CO', local: value };
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { countryCode: c.code, local: value.slice(c.dial.length) };
    }
  }
  return { countryCode: 'CO', local: value.slice(1) };
}

export function getWhatsAppLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  className?: string;
  error?: boolean;
}

export function PhoneInput({ value, onChange, defaultCountry = 'CO', placeholder = '300 000 0000', className, error }: PhoneInputProps) {
  const parsed = parseFullNumber(value);
  const initialCode = value ? parsed.countryCode : defaultCountry;

  const [selectedCode, setSelectedCode] = useState(initialCode);
  const [local, setLocal] = useState(parsed.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const country = PHONE_COUNTRIES.find((c) => c.code === selectedCode) ?? PHONE_COUNTRIES[0];

  useEffect(() => {
    if (!value) return;
    const p = parseFullNumber(value);
    setSelectedCode(p.countryCode);
    setLocal(p.local);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCountrySelect = (code: string) => {
    setSelectedCode(code);
    setOpen(false);
    setSearch('');
    const c = PHONE_COUNTRIES.find((x) => x.code === code)!;
    onChange(local ? `${c.dial}${local}` : '');
  };

  const handleLocalChange = (val: string) => {
    const digits = val.replace(/[^\d\s\-]/g, '');
    setLocal(digits);
    onChange(digits ? `${country.dial}${digits}` : '');
  };

  const filtered = PHONE_COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn('flex gap-0', className)} ref={dropdownRef}>
      {/* Country selector */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-10 rounded-r-none border-r-0 px-2 gap-1 font-normal text-sm',
            error && 'border-destructive'
          )}
          onClick={() => setOpen(!open)}
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="text-xs text-muted-foreground">{country.dial}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>

        {open && (
          <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar país..."
                  className="pl-8 h-8 text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent text-left',
                    selectedCode === c.code && 'bg-accent'
                  )}
                  onClick={() => handleCountrySelect(c.code)}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground text-xs">{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Number input */}
      <Input
        value={local}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder={placeholder}
        className={cn('rounded-l-none flex-1', error && 'border-destructive')}
        inputMode="tel"
      />
    </div>
  );
}
