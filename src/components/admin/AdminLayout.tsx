import { useState, createContext, useContext, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  CalendarDays, BarChart2, Users, UserCog, Kanban,
  LogOut, X, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import grupoEffiLogo from '@/assets/grupo-effi-logo.jpg';
import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/types';

/* ── Context ─────────────────────────────────────────────────── */
type AdminLayoutCtx = { openMobileSidebar: () => void };
const AdminLayoutContext = createContext<AdminLayoutCtx>({ openMobileSidebar: () => {} });
export const useAdminLayout = () => useContext(AdminLayoutContext);

/* ── Nav: CRM para todos; admin-only para el resto ──────────── */
const NAV_ALL = [
  { id: 'crm', label: 'CRM', icon: BarChart2, path: '/admin/crm' },
];
const NAV_ADMIN = [
  { id: 'bookings',    label: 'Bookings',    icon: CalendarDays, path: '/admin' },
  { id: 'pipelines',   label: 'Pipelines',   icon: Kanban,       path: '/admin?section=pipelines' },
  { id: 'comerciales', label: 'Comerciales', icon: Users,        path: '/admin?section=comerciales' },
  { id: 'equipo',      label: 'Usuarios',    icon: UserCog,      path: '/admin?section=equipo' },
];

/* ── Layout ─────────────────────────────────────────────────── */
export default function AdminLayout() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user, isAdmin, canReassign, userRole, isLoading: authLoading, signOut } = useAuth();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('admin-sidebar-collapsed') === 'true'
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Redirigir si no autenticado */
  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  /* Persist collapse */
  const toggleCollapsed = () =>
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin-sidebar-collapsed', String(next));
      return next;
    });

  /* Active nav item */
  const section  = new URLSearchParams(location.search).get('section') ?? 'bookings';
  const activeId = location.pathname.startsWith('/admin/crm') ? 'crm' : section;

  const handleNav = (path: string) => { navigate(path); setMobileOpen(false); };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  // Líderes ven CRM + Mi Equipo; admins ven todo
  const NAV_LEADER = [
    { id: 'equipo', label: 'Mi Equipo', icon: UserCog, path: '/admin?section=equipo' },
  ];
  const navItems = isAdmin
    ? [...NAV_ALL, ...NAV_ADMIN]
    : canReassign
      ? [...NAV_ALL, ...NAV_LEADER]
      : NAV_ALL;

  const roleLabel = userRole ? ROLE_LABELS[userRole] : 'Usuario';

  /* ── Sidebar inner ─────────────────────────────────────────── */
  const SidebarInner = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">

      {/* Brand */}
      <div className={cn(
        'px-3 py-4 border-b border-border flex items-center gap-3',
        collapsed && !isMobile && 'justify-center'
      )}>
        <img src={grupoEffiLogo} alt="Effi" className="h-9 w-9 rounded-lg shrink-0 object-cover" />
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">{roleLabel}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon, path }) => {
          const isActive = id === activeId;
          const btn = (
            <button
              key={id}
              onClick={() => handleNav(path)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                collapsed && !isMobile ? 'justify-center p-2.5' : 'px-3 py-2.5',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(!collapsed || isMobile) && <span>{label}</span>}
            </button>
          );

          /* Wrap with tooltip when collapsed on desktop */
          if (collapsed && !isMobile) {
            return (
              <Tooltip key={id} delayDuration={0}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          }
          return btn;
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-border space-y-0.5">
        {/* Sign out */}
        {collapsed && !isMobile ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={async () => { await signOut(); navigate('/'); }}
                className="w-full flex justify-center p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Cerrar sesión</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleCollapsed}
          className={cn(
            'hidden md:flex w-full items-center rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
            collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" />
            : <><ChevronLeft className="w-4 h-4" /><span>Colapsar</span></>
          }
        </button>
      </div>
    </div>
  );

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <AdminLayoutContext.Provider value={{ openMobileSidebar: () => setMobileOpen(true) }}>
      <div className="min-h-screen flex bg-background">

        {/* Sidebar desktop */}
        <aside className={cn(
          'hidden md:flex flex-col border-r border-border bg-card transition-[width] duration-200 shrink-0',
          collapsed ? 'w-14' : 'w-56'
        )}>
          <SidebarInner />
        </aside>

        {/* Sidebar mobile overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <aside className="relative z-10 w-56 flex flex-col bg-card border-r border-border">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarInner isMobile />
            </aside>
          </div>
        )}

        {/* Page content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </div>

      </div>
    </AdminLayoutContext.Provider>
  );
}
