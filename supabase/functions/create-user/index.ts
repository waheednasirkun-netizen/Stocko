import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.35.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MANAGER_ROLES = new Set(["Developer", "Admin", "Manager"]);
const ASSIGNABLE_ROLES = new Set(["Admin", "Manager", "Store Keeper", "Kitchen Staff", "Viewer"]);
const PROFILE_SELECT = "id, auth_id, email, name, full_name, role, status, phone, branch_id, created_at";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ success: false, error: "Supabase function secrets are not configured" }, 500);
    }
    if (!authorization?.startsWith("Bearer ")) {
      return json({ success: false, error: "Authentication required" }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerAuth.user) {
      return json({ success: false, error: "Your session is invalid or expired" }, 401);
    }

    let { data: caller, error: callerError } = await admin
      .from("users")
      .select("id, auth_id, email, role, status, branch_id")
      .eq("auth_id", callerAuth.user.id)
      .maybeSingle();

    if (!callerError && !caller) {
      const byId = await admin
        .from("users")
        .select("id, auth_id, email, role, status, branch_id")
        .eq("id", callerAuth.user.id)
        .maybeSingle();
      caller = byId.data;
      callerError = byId.error;
    }

    if (!callerError && !caller && callerAuth.user.email) {
      const byEmail = await admin
        .from("users")
        .select("id, auth_id, email, role, status, branch_id")
        .eq("email", callerAuth.user.email.toLowerCase())
        .maybeSingle();
      caller = byEmail.data;
      callerError = byEmail.error;
    }

    if (callerError) return json({ success: false, error: callerError.message }, 400);
    if (!caller || caller.status !== "Active" || !MANAGER_ROLES.has(caller.role)) {
      return json({ success: false, error: "You are not allowed to create users" }, 403);
    }
    if (caller.auth_id && caller.auth_id !== callerAuth.user.id) {
      return json({ success: false, error: "Your profile is linked to a different Auth account" }, 409);
    }
    if (!caller.auth_id) {
      const { error: backfillError } = await admin
        .from("users")
        .update({ auth_id: callerAuth.user.id })
        .eq("id", caller.id);
      if (backfillError) return json({ success: false, error: backfillError.message }, 400);
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const role = String(body.role || "").trim();
    const status = String(body.status || "Active").trim();
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const branchId = caller.role === "Developer" ? body.branch_id || null : caller.branch_id;

    if (!name || !email || !password || !role) {
      return json({ success: false, error: "Name, email, password, and role are required" }, 400);
    }
    if (password.length < 6) {
      return json({ success: false, error: "Password must be at least 6 characters" }, 400);
    }
    if (!ASSIGNABLE_ROLES.has(role)) {
      return json({ success: false, error: "That role cannot be assigned from User Management" }, 400);
    }
    if (!["Active", "Inactive"].includes(status)) {
      return json({ success: false, error: "Invalid user status" }, 400);
    }
    if (!branchId) {
      return json({ success: false, error: "A branch is required" }, 400);
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, status, phone, branch_id: branchId },
    });

    if (authError || !authData.user) {
      return json({ success: false, error: authError?.message || "Auth user creation failed" }, authError?.status || 400);
    }

    const profile = {
      auth_id: authData.user.id,
      name,
      full_name: name,
      email,
      role,
      status,
      phone: phone || null,
      branch_id: branchId,
      updated_at: new Date().toISOString(),
    };

    // Most projects create this row with an auth trigger. Update it when present, insert otherwise.
    let { data: userData, error: dbError } = await admin
      .from("users")
      .update(profile)
      .or(`auth_id.eq.${authData.user.id},id.eq.${authData.user.id}`)
      .select(PROFILE_SELECT)
      .maybeSingle();

    if (!dbError && !userData) {
      const inserted = await admin
        .from("users")
        .insert(profile)
        .select(PROFILE_SELECT)
        .single();
      userData = inserted.data;
      dbError = inserted.error;
    }

    if (dbError || !userData) {
      await admin.auth.admin.deleteUser(authData.user.id);
      return json({ success: false, error: dbError?.message || "Profile creation failed" }, 400);
    }

    return json({ success: true, user: userData });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
