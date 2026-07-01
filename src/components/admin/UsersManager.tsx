import { useState, useEffect } from 'react';
import { Loader2, UserPlus, Pencil, Link2, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  UserWithRole,
  fetchUsersWithRoles,
  assignRole,
  linkToCommercial,
  unlinkFromCommercial,
  fetchAvailableCommercials,
  updateUserProfile,
} from '@/lib/authService';
import { AppRole, ROLE_LABELS, ROLE_LEVEL } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';

const COUNTRIES = ['CO', 'GT', 'CR', 'DO', 'EC', 'MX', 'PE', 'CL'];

const ROLE_OPTIONS: AppRole[] = [
  'root', 'admin', 'lider_area', 'lider_comercial_pais',
  'lider_comercial', 'comercial', 'setter', 'closer', 'user',
];

const ROLE_BADGE_COLORS: Record<number, string> = {
  7: 'bg-red-100 text-red-800',
  6: 'bg-purple-100 text-purple-800',
  5: 'bg-blue-100 text-blue-800',
  4: 'bg-cyan-100 text-cyan-800',
  3: 'bg-green-100 text-green-800',
  2: 'bg-yellow-100 text-yellow-800',
  1: 'bg-gray-100 text-gray-800',
};

export function UsersManager() {
  const { user: currentUser, userRole: currentRole, isAdmin } = useAuth();
  const currentLevel = currentRole ? ROLE_LEVEL[currentRole] : 0;

  // Roles que este usuario puede asignar (solo por debajo de su nivel)
  const assignableRoles = ROLE_OPTIONS.filter((r) => ROLE_LEVEL[r] < currentLevel);

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [commercials, setCommercials] = useState<Array<{ id: string; name: string; email: string; country: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>(assignableRoles[0] ?? 'comercial');
  const [inviteLoading, setInviteLoading] = useState(false);

  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editRole, setEditRole] = useState<AppRole>('user');
  const [editReportsTo, setEditReportsTo] = useState<string>('');
  const [editCountry, setEditCountry] = useState<string>('CO');
  const [editArea, setEditArea] = useState<string>('');
  const [editCommercial, setEditCommercial] = useState<string>('');
  const [editLoading, setEditLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [usersData, commercialsData] = await Promise.all([
        fetchUsersWithRoles(),
        fetchAvailableCommercials(),
      ]);
      setUsers(usersData);
      setCommercials(commercialsData);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteEmail.trim(),
          role: inviteRole,
          reportsTo: currentUser?.id,
        },
      });
      if (error) throw error;
      toast.success(`Invitación enviada a ${inviteEmail} como ${ROLE_LABELS[inviteRole]}`);
      setInviteEmail('');
      setInviteOpen(false);
      setTimeout(load, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al invitar usuario';
      toast.error(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const openEdit = (u: UserWithRole) => {
    setEditUser(u);
    setEditFullName(u.full_name ?? '');
    setEditRole(u.role ?? 'user');
    setEditReportsTo(u.reports_to ?? '');
    setEditCountry(u.country ?? 'CO');
    setEditArea(u.area ?? '');
    setEditCommercial(u.commercial_id ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      await Promise.all([
        updateUserProfile(editUser.id, editFullName),
        assignRole({
          userId: editUser.id,
          role: editRole,
          reportsTo: editReportsTo || null,
          country: editCountry || null,
          area: editArea || null,
        }),
      ]);

      if (editCommercial && editCommercial !== editUser.commercial_id) {
        await linkToCommercial(editUser.id, editCommercial);
      } else if (!editCommercial && editUser.commercial_id) {
        await unlinkFromCommercial(editUser.id);
      }

      toast.success('Usuario actualizado');
      setEditUser(null);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast.error(msg);
    } finally {
      setEditLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const leaders = users.filter((u) => u.role && ROLE_LEVEL[u.role] >= 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">
              {isAdmin ? 'Usuarios y Roles' : 'Mi Equipo'}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {users.length} {isAdmin ? 'usuarios registrados' : 'miembros en tu equipo'}
          </p>
        </div>
        <Button size="sm" onClick={() => { setInviteEmail(''); setInviteRole(assignableRoles[0] ?? 'comercial'); setInviteOpen(true); }} className="gap-1.5">
          <UserPlus className="w-4 h-4" />
          Invitar
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs">
              <th className="text-left py-2 pr-3 font-medium">Usuario</th>
              <th className="text-left py-2 pr-3 font-medium">Rol</th>
              <th className="text-left py-2 pr-3 font-medium">País</th>
              <th className="text-left py-2 pr-3 font-medium">Reporta a</th>
              <th className="text-left py-2 pr-3 font-medium">Comercial vinculado</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const level = u.role ? ROLE_LEVEL[u.role] : 1;
              const badgeColor = ROLE_BADGE_COLORS[level] ?? ROLE_BADGE_COLORS[1];
              const reportsToUser = users.find((x) => x.id === u.reports_to);
              return (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-foreground">{u.full_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    {u.role ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin rol</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{u.country ?? '—'}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {reportsToUser ? (reportsToUser.full_name ?? reportsToUser.email) : '—'}
                  </td>
                  <td className="py-2.5 pr-3">
                    {u.commercial_name ? (
                      <div className="flex items-center gap-1.5">
                        <Link2 className="w-3 h-3 text-green-500" />
                        <span className="text-xs">{u.commercial_name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">No vinculado</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(u)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog: Invitar usuario */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar a mi equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Email corporativo</Label>
              <Input
                type="email"
                placeholder="usuario@empresa.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rol asignado</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El usuario quedará en tu cadena de reporte automáticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteLoading}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar usuario */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Editar: {editUser?.full_name ?? editUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nombre completo</Label>
              <Input
                placeholder="Nombre del usuario"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>País</Label>
              <Select value={editCountry} onValueChange={setEditCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Área <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                placeholder="ej: Ventas, Onboarding..."
                value={editArea}
                onChange={(e) => setEditArea(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Reporta a <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select
                value={editReportsTo || '__none__'}
                onValueChange={(v) => setEditReportsTo(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin líder asignado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin líder</SelectItem>
                  {leaders
                    .filter((l) => l.id !== editUser?.id)
                    .map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.full_name ?? l.email} · {l.role ? ROLE_LABELS[l.role] : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Comercial vinculado <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Select
                value={editCommercial || '__none__'}
                onValueChange={(v) => setEditCommercial(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin comercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin comercial</SelectItem>
                  {commercials.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Vincula al usuario con su perfil en commercial_calendars para que vea sus leads.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={editLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
