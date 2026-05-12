import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') ?? 'https://effidiagnosticos.com'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
}

const ROLE_LEVEL: Record<string, number> = {
  root: 7, admin: 6, lider_area: 5, lider_comercial_pais: 4,
  lider_comercial: 3, comercial: 2, setter: 2, closer: 2, user: 1,
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    // Verificar JWT del invitador
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !caller) return json({ error: 'Token inválido' }, 401)

    // Obtener rol del invitador
    const { data: callerRoleData } = await supabase
      .from('user_roles')
      .select('role, country')
      .eq('user_id', caller.id)
      .maybeSingle()

    const callerRole = callerRoleData?.role as string | undefined
    const callerLevel = callerRole ? (ROLE_LEVEL[callerRole] ?? 0) : 0
    const callerCountry = callerRoleData?.country ?? 'CO'

    // Solo líderes (nivel >= 3) pueden invitar
    if (callerLevel < 3) {
      return json({ error: 'No tienes permisos para invitar usuarios' }, 403)
    }

    const body = await req.json() as { email: string; role?: string; reportsTo?: string }
    const { email, role: targetRole, reportsTo } = body

    if (!email || !email.includes('@')) return json({ error: 'Email inválido' }, 400)

    // Validar que el rol asignado sea menor al del invitador
    if (targetRole) {
      const targetLevel = ROLE_LEVEL[targetRole] ?? 0
      if (targetLevel >= callerLevel) {
        return json({ error: 'No puedes asignar un rol igual o superior al tuyo' }, 403)
      }
    }

    // Enviar invitación por email
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${APP_URL}/auth`,
      data: { needs_password_set: true },
    })
    if (error) throw error

    const newUserId = data.user?.id

    // Crear user_roles automáticamente con rol y jerarquía
    if (newUserId && targetRole) {
      await supabase.from('user_roles').upsert({
        user_id: newUserId,
        role: targetRole,
        reports_to: reportsTo ?? caller.id,
        country: callerCountry,
      }, { onConflict: 'user_id' })
    }

    return json({ success: true, user_id: newUserId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return json({ error: message }, 500)
  }
})
