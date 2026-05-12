import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, isAdminRole, canReassignCommercial, isLeaderRole } from '@/lib/types';

export interface CommercialProfile {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  userRole: AppRole | null;
  isAdmin: boolean;
  canReassign: boolean;
  isLeader: boolean;
  commercialProfile: CommercialProfile | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [commercialProfile, setCommercialProfile] = useState<CommercialProfile | null>(null);

  const checkUserData = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      const role = (roleData?.role as AppRole) ?? null;
      setUserRole(role);

      // Cargar perfil comercial si el usuario tiene un rol de campo
      let profile: CommercialProfile | null = null;
      if (role && !isAdminRole(role)) {
        const { data: cc } = await supabase
          .from('commercial_calendars')
          .select('id, name')
          .eq('user_id', userId)
          .maybeSingle();
        if (cc) profile = { id: cc.id, name: cc.name };
      }
      setCommercialProfile(profile);
    } catch {
      // silent - auth still works without role data
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => checkUserData(session.user.id), 0);
        } else {
          setUserRole(null);
          setCommercialProfile(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        checkUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setCommercialProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isLoading,
      userRole,
      isAdmin: isAdminRole(userRole),
      canReassign: canReassignCommercial(userRole),
      isLeader: isLeaderRole(userRole),
      commercialProfile,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
