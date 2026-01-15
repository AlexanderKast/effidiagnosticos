import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Shield, ShieldOff, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  created_at: string;
}

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      
      // Get all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get all admin roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminUserIds = new Set(roles?.map(r => r.user_id) || []);

      const teamMembers: TeamMember[] = (profiles || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        email: p.email || '',
        full_name: p.full_name,
        is_admin: adminUserIds.has(p.user_id),
        created_at: p.created_at,
      }));

      setMembers(teamMembers);
    } catch (error) {
      console.error('Error loading team members:', error);
      toast.error('Error al cargar el equipo');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAdminRole = async (member: TeamMember) => {
    try {
      if (member.is_admin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', member.user_id)
          .eq('role', 'admin');

        if (error) throw error;
        toast.success(`Rol admin removido de ${member.email}`);
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert([{ user_id: member.user_id, role: 'admin' }]);

        if (error) throw error;
        toast.success(`Rol admin asignado a ${member.email}`);
      }

      await loadMembers();
    } catch (error: any) {
      console.error('Error toggling admin role:', error);
      toast.error(error.message || 'Error al cambiar el rol');
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !invitePassword) {
      toast.error('Email y contraseña son requeridos');
      return;
    }

    setIsInviting(true);
    try {
      // Create new user
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: inviteName,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Assign admin role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: data.user.id, role: 'admin' }]);

        if (roleError) {
          console.error('Error assigning role:', roleError);
          // User created but role assignment failed
          toast.warning('Usuario creado, pero hubo un error asignando el rol admin');
        } else {
          toast.success(`Usuario ${inviteEmail} creado con rol admin`);
        }
      }

      setIsInviteOpen(false);
      setInviteEmail('');
      setInvitePassword('');
      setInviteName('');
      
      // Reload after a short delay to allow the profile trigger to complete
      setTimeout(() => loadMembers(), 1000);
    } catch (error: any) {
      console.error('Error inviting user:', error);
      if (error.message.includes('already registered')) {
        toast.error('Este email ya está registrado');
      } else {
        toast.error(error.message || 'Error al invitar usuario');
      }
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Equipo</h3>
            <p className="text-sm text-muted-foreground">
              {members.filter(m => m.is_admin).length} administradores
            </p>
          </div>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Invitar Admin
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No hay miembros registrados
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.full_name || 'Sin nombre'}
                </TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  {member.is_admin ? (
                    <Badge variant="default" className="gap-1">
                      <Shield className="w-3 h-3" />
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Usuario</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAdminRole(member)}
                    className="gap-2"
                  >
                    {member.is_admin ? (
                      <>
                        <ShieldOff className="w-4 h-4" />
                        Quitar Admin
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Hacer Admin
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Administrador</DialogTitle>
            <DialogDescription>
              Crea una cuenta con rol de administrador para un miembro del equipo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-name">Nombre</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-password">Contraseña temporal *</Label>
              <Input
                id="invite-password"
                type="password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <p className="text-xs text-muted-foreground">
                El usuario podrá cambiarla después
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={isInviting}>
              {isInviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Usuario'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
