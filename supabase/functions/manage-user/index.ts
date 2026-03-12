import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the authorization header to verify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the caller is HR or higher
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check caller has HR role or higher
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const allowedRoles = ['developer', 'superadmin', 'founder', 'hr'];
    const hasPermission = callerRoles?.some(r => allowedRoles.includes(r.role));

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userId, data } = await req.json();
    console.log(`[Manage User] Action: ${action}, Target: ${userId}`);

    switch (action) {
      case 'update_password': {
        if (!data?.password) {
          return new Response(
            JSON.stringify({ error: 'Password is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: data.password,
        });
        
        if (error) throw error;
        console.log(`[Manage User] Password updated for ${userId}`);
        break;
      }

      case 'update_email': {
        if (!data?.email) {
          return new Response(
            JSON.stringify({ error: 'Email is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: data.email,
        });
        
        if (error) throw error;
        
        // Also update profile
        await supabaseAdmin
          .from('profiles')
          .update({ email: data.email })
          .eq('user_id', userId);
          
        console.log(`[Manage User] Email updated for ${userId}`);
        break;
      }

      case 'update_profile': {
        const updateData: any = {};
        if (data?.username) updateData.username = data.username;
        if (data?.avatar_url) updateData.avatar_url = data.avatar_url;
        if (data?.tmp_id !== undefined) updateData.tmp_id = data.tmp_id;
        
        const { error } = await supabaseAdmin
          .from('profiles')
          .update(updateData)
          .eq('user_id', userId);
          
        if (error) throw error;
        console.log(`[Manage User] Profile updated for ${userId}`);
        break;
      }

      case 'delete_user': {
        // Delete from auth (this cascades to profiles due to FK)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) throw error;
        console.log(`[Manage User] User deleted: ${userId}`);
        break;
      }

      case 'set_roles': {
        if (!data?.roles || !Array.isArray(data.roles)) {
          return new Response(
            JSON.stringify({ error: 'Roles array is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Delete existing roles
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        // Insert new roles
        if (data.roles.length > 0) {
          const roleInserts = data.roles.map((role: string) => ({
            user_id: userId,
            role: role,
            assigned_by: caller.id,
          }));
          
          const { error } = await supabaseAdmin
            .from('user_roles')
            .insert(roleInserts);
            
          if (error) throw error;
        }
        
        console.log(`[Manage User] Roles set for ${userId}: ${data.roles.join(', ')}`);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log the action
    await supabaseAdmin.from('system_logs').insert({
      actor_id: caller.id,
      action_type: `hr_${action}`,
      target_user_id: userId,
      details: { action, ...data },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Manage User] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
