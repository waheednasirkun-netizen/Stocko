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
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
    if (callerAuthError || !callerAuth.user) {
      return json({ success: false, error: "Your session is invalid or expired" }, 401);
    }

    let { data: caller, error: callerError } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, email, role, status, branch_id")
      .eq("auth_id", callerAuth.user.id)
      .maybeSingle();

    if (!callerError && !caller) {
      const byId = await supabaseAdmin
        .from("users")
        .select("id, auth_id, email, role, status, branch_id")
        .eq("id", callerAuth.user.id)
        .maybeSingle();
      caller = byId.data;
      callerError = byId.error;
    }

    if (!callerError && !caller && callerAuth.user.email) {
      const byEmail = await supabaseAdmin
        .from("users")
        .select("id, auth_id, email, role, status, branch_id")
        .eq("email", callerAuth.user.email.toLowerCase())
        .maybeSingle();
      caller = byEmail.data;
      callerError = byEmail.error;
    }

    if (callerError) return json({ success: false, error: callerError.message }, 400);
    if (!caller || caller.status !== "Active" || !MANAGER_ROLES.has(caller.role)) {
      return json({ success: false, error: "You are not allowed to manage users" }, 403);
    }
    if (caller.auth_id && caller.auth_id !== callerAuth.user.id) {
      return json({ success: false, error: "Your profile is linked to a different Auth account" }, 409);
    }
    if (!caller.auth_id) {
      const { error: callerBackfillError } = await supabaseAdmin
        .from("users")
        .update({ auth_id: callerAuth.user.id })
        .eq("id", caller.id);
      if (callerBackfillError) {
        return json({ success: false, error: `Could not backfill caller auth_id: ${callerBackfillError.message}` }, 400);
      }
    }

    const body = await req.json();
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const role = String(body.role || "").trim();
    const status = String(body.status || "Active").trim();
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!id || !name || !email || !role) {
      return json({ success: false, error: "User ID, name, email, and role are required" }, 400);
    }
    if (password && password.length < 6) {
      return json({ success: false, error: "Password must be at least 6 characters" }, 400);
    }
    if (!["Active", "Inactive"].includes(status)) {
      return json({ success: false, error: "Invalid user status" }, 400);
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from("users")
      .select("id, auth_id, email, role, branch_id")
      .eq("id", id)
      .single();

    if (targetError || !target) {
      return json({ success: false, error: targetError?.message || "User profile not found" }, 404);
    }

    const isDeveloper = caller.role === "Developer";
    const isEditingExistingDeveloper = isDeveloper && target.role === "Developer" && role === "Developer";
    if (!ASSIGNABLE_ROLES.has(role) && !isEditingExistingDeveloper) {
      return json({ success: false, error: "That role cannot be assigned from User Management" }, 400);
    }
    if (!isDeveloper && !caller.branch_id) {
      return json({ success: false, error: "Your account is not assigned to a branch" }, 403);
    }
    if (!isDeveloper && target.branch_id !== caller.branch_id) {
      return json({ success: false, error: "You can only update users in your branch" }, 403);
    }
    if (!isDeveloper && target.role === "Developer") {
      return json({ success: false, error: "Only a Developer can update a Developer account" }, 403);
    }

    let authId = target.auth_id || null;
    let authUserBefore: { id: string; email?: string; updated_at?: string } | null = null;

    if (authId) {
      const storedAuth = await supabaseAdmin.auth.admin.getUserById(authId);
      if (storedAuth.error || !storedAuth.data.user) {
        authId = null;
      } else {
        authUserBefore = storedAuth.data.user;
      }
    }

    // Some older installations use auth.users.id as public.users.id.
    if (!authId) {
      const byProfileId = await supabaseAdmin.auth.admin.getUserById(target.id);
      if (!byProfileId.error && byProfileId.data.user) {
        authId = byProfileId.data.user.id;
        authUserBefore = byProfileId.data.user;
      }
    }

    // Resolve legacy profiles by email and backfill auth_id. Paginate for large projects.
    if (!authId) {
      const targetEmail = target.email?.toLowerCase();
      for (let page = 1; targetEmail; page += 1) {
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listError) return json({ success: false, error: listError.message }, 400);

        const match = authUsers.users.find(
          (authUser) => authUser.email?.toLowerCase() === targetEmail,
        );
        if (match) {
          authId = match.id;
          authUserBefore = match;
          break;
        }
        if (authUsers.users.length < 1000) break;
      }
    }

    if (!authId || !authUserBefore) {
      return json({
        success: false,
        error: "No Supabase Auth account matches this profile. Check the user's email in Authentication > Users.",
      }, 409);
    }

    if (target.auth_id !== authId) {
      const { error: authIdBackfillError } = await supabaseAdmin
        .from("users")
        .update({ auth_id: authId })
        .eq("id", target.id);
      if (authIdBackfillError) {
        return json({ success: false, error: `Could not backfill auth_id: ${authIdBackfillError.message}` }, 400);
      }
    }

    const branchId = isDeveloper ? body.branch_id || null : target.branch_id;
    const authUpdates: {
      password?: string;
      email?: string;
      email_confirm?: boolean;
      user_metadata: Record<string, unknown>;
    } = {
      user_metadata: { name, role, status, phone, branch_id: branchId },
    };
    if (password) authUpdates.password = password;
    if (email !== authUserBefore.email?.toLowerCase()) {
      authUpdates.email = email;
      authUpdates.email_confirm = true;
    }

    const diagnosticBase = {
      projectHost: new URL(supabaseUrl).hostname,
      profileId: target.id,
      resolvedAuthId: authId,
      authEmail: authUserBefore.email || null,
      passwordReceived: Boolean(password),
      passwordLength: password.length,
      updateFields: Object.keys(authUpdates),
      authUpdatedAtBefore: authUserBefore.updated_at || null,
    };
    console.log("[update-user] Auth update starting", diagnosticBase);

    const { data: authUpdateData, error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(authId, authUpdates);

    if (authUpdateError || !authUpdateData.user) {
      console.error("[update-user] Auth update failed", {
        ...diagnosticBase,
        error: authUpdateError?.message || "No Auth user returned",
      });
      return json({
        success: false,
        error: `Auth update failed: ${authUpdateError?.message || "No Auth user returned"}`,
        passwordUpdated: false,
        passwordVerified: false,
      }, authUpdateError?.status || 400);
    }

    const authEmail = authUpdateData.user.email?.toLowerCase();
    if (!authEmail) {
      return json({
        success: false,
        error: "Auth update returned a user without an email address",
        passwordUpdated: Boolean(password),
        passwordVerified: false,
      }, 500);
    }

    const profileUpdates: Record<string, unknown> = {
      auth_id: authId,
      name,
      full_name: name,
      email: authEmail,
      role,
      status,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    };
    if (isDeveloper) profileUpdates.branch_id = branchId;

    const { data: updatedUser, error: profileError } = await supabaseAdmin
      .from("users")
      .update(profileUpdates)
      .eq("id", id)
      .select(PROFILE_SELECT)
      .single();

    if (profileError || !updatedUser) {
      return json({
        success: false,
        error: `Auth was updated, but profile sync failed: ${profileError?.message || "No profile returned"}`,
        passwordUpdated: Boolean(password),
        passwordVerified: false,
      }, 500);
    }

    let passwordVerified = false;
    if (password) {
      const verificationClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
      const { data: verificationData, error: verificationError } =
        await verificationClient.auth.signInWithPassword({ email: authEmail, password });

      passwordVerified = !verificationError && verificationData.user?.id === authId;
      await verificationClient.auth.signOut({ scope: "local" });

      if (!passwordVerified) {
        console.error("[update-user] New credential verification failed", {
          projectHost: diagnosticBase.projectHost,
          profileId: target.id,
          resolvedAuthId: authId,
          authEmail,
          authUpdatedAtAfter: authUpdateData.user.updated_at || null,
          error: verificationError?.message || "Verified user ID did not match",
        });
        return json({
          success: false,
          error: `Auth update returned successfully, but new-password verification failed: ${verificationError?.message || "Auth user mismatch"}`,
          passwordUpdated: true,
          passwordVerified: false,
        }, 409);
      }
    }

    console.log("[update-user] Update verified", {
      projectHost: diagnosticBase.projectHost,
      profileId: target.id,
      resolvedAuthId: authId,
      authEmail,
      passwordReceived: Boolean(password),
      passwordLength: password.length,
      updateFields: Object.keys(authUpdates),
      authUpdatedAtBefore: authUserBefore.updated_at || null,
      authUpdatedAtAfter: authUpdateData.user.updated_at || null,
      passwordVerified,
    });

    return json({
      success: true,
      user: updatedUser,
      passwordUpdated: Boolean(password),
      passwordVerified,
    });
  } catch (error) {
    console.error("[update-user] Unhandled error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      passwordUpdated: false,
      passwordVerified: false,
    }, 500);
  }
});
