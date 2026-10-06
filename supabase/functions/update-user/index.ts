
import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.35.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

/*
 * Roles that are allowed to access user management.
 *
 * IMPORTANT:
 * Being in MANAGER_ROLES does NOT mean the role can assign Master.
 * Master assignment is separately restricted to Developer only.
 */
const MANAGER_ROLES = new Set([
  "Developer",
  "Master",
  "Admin",
  "Manager",
]);

/*
 * Normal roles assignable through User Management.
 * Master is intentionally excluded and handled separately.
 * Developer is also intentionally excluded.
 */
const ASSIGNABLE_ROLES = new Set([
  "Admin",
  "Manager",
  "Store Keeper",
  "Kitchen Staff",
  "Viewer",
]);

const MASTER_ROLE = "Master";
const DEVELOPER_ROLE = "Developer";

const PROFILE_SELECT =
  "id, auth_id, email, name, full_name, role, status, phone, branch_id, created_at";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    /*
     * -------------------------------------------------------
     * 1. ENVIRONMENT
     * -------------------------------------------------------
     */

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(
        {
          success: false,
          error: "Supabase function secrets are not configured",
        },
        500,
      );
    }

    if (!authorization?.startsWith("Bearer ")) {
      return json(
        {
          success: false,
          error: "Authentication required",
        },
        401,
      );
    }

    const accessToken = authorization
      .slice("Bearer ".length)
      .trim();

    if (!accessToken) {
      return json(
        {
          success: false,
          error: "Authentication required",
        },
        401,
      );
    }

    /*
     * -------------------------------------------------------
     * 2. CREATE SUPABASE CLIENTS
     * -------------------------------------------------------
     *
     * callerClient:
     * Uses the logged-in user's JWT.
     *
     * supabaseAdmin:
     * Uses service-role and performs Auth administration.
     */

    const callerClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );

    /*
     * -------------------------------------------------------
     * 3. VERIFY CALLER JWT
     * -------------------------------------------------------
     */

    const {
      data: { user: callerAuthUser },
      error: callerAuthError,
    } = await callerClient.auth.getUser(accessToken);

    if (callerAuthError || !callerAuthUser) {
      console.error("[update-user] Caller authentication failed", {
        message: callerAuthError?.message,
        status: callerAuthError?.status,
      });

      return json(
        {
          success: false,
          error: "Your session is invalid or expired",
        },
        401,
      );
    }

    /*
     * -------------------------------------------------------
     * 4. LOAD CALLER PROFILE
     * -------------------------------------------------------
     */

    let {
      data: caller,
      error: callerError,
    } = await supabaseAdmin
      .from("users")
      .select(
        "id, auth_id, email, role, status, branch_id, organization_id",
      )
      .eq("auth_id", callerAuthUser.id)
      .maybeSingle();

    /*
     * Legacy support:
     * Some Stocko installations used auth.users.id
     * directly as public.users.id.
     */
    if (!callerError && !caller) {
      const byId = await supabaseAdmin
        .from("users")
        .select(
          "id, auth_id, email, role, status, branch_id, organization_id",
        )
        .eq("id", callerAuthUser.id)
        .maybeSingle();

      caller = byId.data;
      callerError = byId.error;
    }

    /*
     * Last legacy fallback:
     * Match caller by email.
     */
    if (
      !callerError &&
      !caller &&
      callerAuthUser.email
    ) {
      const byEmail = await supabaseAdmin
        .from("users")
        .select(
          "id, auth_id, email, role, status, branch_id, organization_id",
        )
        .ilike("email", callerAuthUser.email)
        .maybeSingle();

      caller = byEmail.data;
      callerError = byEmail.error;
    }

    if (callerError) {
      return json(
        {
          success: false,
          error: callerError.message,
        },
        400,
      );
    }

    if (!caller) {
      return json(
        {
          success: false,
          error: "Your Stocko user profile could not be found",
        },
        403,
      );
    }

    if (caller.status !== "Active") {
      return json(
        {
          success: false,
          error: "Your account is inactive",
        },
        403,
      );
    }

    if (!MANAGER_ROLES.has(caller.role)) {
      return json(
        {
          success: false,
          error: "You are not allowed to manage users",
        },
        403,
      );
    }

    /*
     * Ensure the profile belongs to the authenticated user.
     */
    if (
      caller.auth_id &&
      caller.auth_id !== callerAuthUser.id
    ) {
      return json(
        {
          success: false,
          error:
            "Your profile is linked to a different Auth account",
        },
        409,
      );
    }

    /*
     * Backfill auth_id for old Stocko profiles.
     */
    if (!caller.auth_id) {
      const { error: callerBackfillError } =
        await supabaseAdmin
          .from("users")
          .update({
            auth_id: callerAuthUser.id,
          })
          .eq("id", caller.id);

      if (callerBackfillError) {
        return json(
          {
            success: false,
            error:
              `Could not backfill caller auth_id: ${callerBackfillError.message}`,
          },
          400,
        );
      }

      caller.auth_id = callerAuthUser.id;
    }

    /*
     * -------------------------------------------------------
     * 5. READ REQUEST
     * -------------------------------------------------------
     */

    const body = await req.json();

    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const role = String(body.role || "").trim();

    const status = String(
      body.status || "Active",
    ).trim();

    const phone =
      typeof body.phone === "string"
        ? body.phone.trim()
        : "";

    if (!id || !name || !email || !role) {
      return json(
        {
          success: false,
          error:
            "User ID, name, email, and role are required",
        },
        400,
      );
    }

    if (password && password.length < 6) {
      return json(
        {
          success: false,
          error:
            "Password must be at least 6 characters",
        },
        400,
      );
    }

    if (!["Active", "Inactive"].includes(status)) {
      return json(
        {
          success: false,
          error: "Invalid user status",
        },
        400,
      );
    }

    /*
     * -------------------------------------------------------
     * 6. LOAD TARGET USER
     * -------------------------------------------------------
     */

    const {
      data: target,
      error: targetError,
    } = await supabaseAdmin
      .from("users")
      .select(
        "id, auth_id, email, role, branch_id, organization_id",
      )
      .eq("id", id)
      .single();

    if (targetError || !target) {
      return json(
        {
          success: false,
          error:
            targetError?.message ||
            "User profile not found",
        },
        404,
      );
    }

    /*
     * -------------------------------------------------------
     * 7. ROLE PERMISSIONS
     * -------------------------------------------------------
     */

    const isDeveloper =
      caller.role === DEVELOPER_ROLE;

    const isMaster =
      caller.role === MASTER_ROLE;

    /*
     * Developer + Master can work across branches.
     *
     * This DOES NOT give Master permission to create
     * or modify Master accounts.
     */
    const isGlobalManager =
      isDeveloper || isMaster;

    /*
     * Developer accounts cannot normally be assigned from
     * User Management.
     *
     * This allows a Developer to edit an existing Developer
     * without changing that Developer role.
     */
    const isEditingExistingDeveloper =
      isDeveloper &&
      target.role === DEVELOPER_ROLE &&
      role === DEVELOPER_ROLE;

    /*
     * =======================================================
     * MASTER SECURITY RULE
     * =======================================================
     *
     * ONLY Developer can assign Master.
     *
     * Master cannot assign another Master.
     * Admin cannot assign Master.
     * Manager cannot assign Master.
     */

    if (
      role === MASTER_ROLE &&
      !isDeveloper
    ) {
      return json(
        {
          success: false,
          error:
            "Only a Developer can assign the Master role",
        },
        403,
      );
    }

    /*
     * ONLY Developer can modify an existing Master account.
     */
    if (
      target.role === MASTER_ROLE &&
      !isDeveloper
    ) {
      return json(
        {
          success: false,
          error:
            "Only a Developer can modify a Master account",
        },
        403,
      );
    }

    /*
     * Only Developer can update Developer accounts.
     */
    if (
      target.role === DEVELOPER_ROLE &&
      !isDeveloper
    ) {
      return json(
        {
          success: false,
          error:
            "Only a Developer can update a Developer account",
        },
        403,
      );
    }

    /*
     * Prevent assigning Developer through ordinary
     * User Management.
     */
    if (
      role === DEVELOPER_ROLE &&
      !isEditingExistingDeveloper
    ) {
      return json(
        {
          success: false,
          error:
            "The Developer role cannot be assigned from User Management",
        },
        403,
      );
    }

    /*
     * Managers cannot promote users to Admin.
     */
    if (
      role === "Admin" &&
      caller.role === "Manager"
    ) {
      return json(
        {
          success: false,
          error:
            "Managers cannot assign the Admin role",
        },
        403,
      );
    }

    /*
     * Validate assignable roles.
     */
    const roleAllowed =
      ASSIGNABLE_ROLES.has(role) ||
      (role === MASTER_ROLE && isDeveloper) ||
      isEditingExistingDeveloper;

    if (!roleAllowed) {
      return json(
        {
          success: false,
          error:
            "That role cannot be assigned from User Management",
        },
        400,
      );
    }

    /*
     * Branch restrictions for Admin/Manager.
     */
    if (
      !isGlobalManager &&
      !caller.branch_id
    ) {
      return json(
        {
          success: false,
          error:
            "Your account is not assigned to a branch",
        },
        403,
      );
    }

    if (
      !isGlobalManager &&
      target.branch_id !== caller.branch_id
    ) {
      return json(
        {
          success: false,
          error:
            "You can only update users in your branch",
        },
        403,
      );
    }

    /*
     * -------------------------------------------------------
     * 8. RESOLVE TARGET AUTH USER
     * -------------------------------------------------------
     */

    let authId = target.auth_id || null;

    let authUserBefore:
      | {
          id: string;
          email?: string;
          updated_at?: string;
        }
      | null = null;

    /*
     * First try stored auth_id.
     */
    if (authId) {
      const storedAuth =
        await supabaseAdmin.auth.admin.getUserById(
          authId,
        );

      if (
        storedAuth.error ||
        !storedAuth.data.user
      ) {
        authId = null;
      } else {
        authUserBefore = storedAuth.data.user;
      }
    }

    /*
     * Legacy:
     * public.users.id may equal auth.users.id.
     */
    if (!authId) {
      const byProfileId =
        await supabaseAdmin.auth.admin.getUserById(
          target.id,
        );

      if (
        !byProfileId.error &&
        byProfileId.data.user
      ) {
        authId = byProfileId.data.user.id;
        authUserBefore =
          byProfileId.data.user;
      }
    }

    /*
     * Last fallback:
     * find Auth account by email.
     */
    if (!authId) {
      const targetEmail =
        target.email?.toLowerCase();

      for (
        let page = 1;
        targetEmail;
        page += 1
      ) {
        const {
          data: authUsers,
          error: listError,
        } =
          await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 1000,
          });

        if (listError) {
          return json(
            {
              success: false,
              error: listError.message,
            },
            400,
          );
        }

        const match = authUsers.users.find(
          (authUser) =>
            authUser.email?.toLowerCase() ===
            targetEmail,
        );

        if (match) {
          authId = match.id;
          authUserBefore = match;
          break;
        }

        if (authUsers.users.length < 1000) {
          break;
        }
      }
    }

    if (!authId || !authUserBefore) {
      return json(
        {
          success: false,
          error:
            "No Supabase Auth account matches this profile. Check the user's email in Authentication > Users.",
        },
        409,
      );
    }

    /*
     * Backfill target auth_id if necessary.
     */
    if (target.auth_id !== authId) {
      const { error: authIdBackfillError } =
        await supabaseAdmin
          .from("users")
          .update({
            auth_id: authId,
          })
          .eq("id", target.id);

      if (authIdBackfillError) {
        return json(
          {
            success: false,
            error:
              `Could not backfill auth_id: ${authIdBackfillError.message}`,
          },
          400,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * 9. BRANCH
     * -------------------------------------------------------
     */

    const requestedBranchId =
      typeof body.branch_id === "string" &&
      body.branch_id.trim()
        ? body.branch_id.trim()
        : null;

    /*
     * Developer/Master can manage branch assignment.
     * Admin/Manager keep target's existing branch.
     */
    const branchId = isGlobalManager
      ? requestedBranchId
      : target.branch_id;

    /*
     * -------------------------------------------------------
     * 10. UPDATE SUPABASE AUTH
     * -------------------------------------------------------
     */

    const authUpdates: {
      password?: string;
      email?: string;
      email_confirm?: boolean;
      user_metadata: Record<string, unknown>;
    } = {
      user_metadata: {
        name,
        role,
        status,
        phone,
        branch_id: branchId,
      },
    };

    if (password) {
      authUpdates.password = password;
    }

    if (
      email !==
      authUserBefore.email?.toLowerCase()
    ) {
      authUpdates.email = email;
      authUpdates.email_confirm = true;
    }

    console.log(
      "[update-user] Auth update starting",
      {
        callerAuthId: callerAuthUser.id,
        callerEmail:
          callerAuthUser.email || null,
        callerRole: caller.role,
        targetProfileId: target.id,
        targetAuthId: authId,
        oldRole: target.role,
        newRole: role,
      },
    );

    const {
      data: authUpdateData,
      error: authUpdateError,
    } =
      await supabaseAdmin.auth.admin.updateUserById(
        authId,
        authUpdates,
      );

    if (
      authUpdateError ||
      !authUpdateData.user
    ) {
      console.error(
        "[update-user] Auth update failed",
        {
          error:
            authUpdateError?.message ||
            "No Auth user returned",
        },
      );

      return json(
        {
          success: false,
          error:
            `Auth update failed: ${
              authUpdateError?.message ||
              "No Auth user returned"
            }`,
          passwordUpdated: false,
          passwordVerified: false,
        },
        authUpdateError?.status || 400,
      );
    }

    const authEmail =
      authUpdateData.user.email?.toLowerCase();

    if (!authEmail) {
      return json(
        {
          success: false,
          error:
            "Auth update returned a user without an email address",
          passwordUpdated: Boolean(password),
          passwordVerified: false,
        },
        500,
      );
    }

    /*
     * -------------------------------------------------------
     * 11. UPDATE PUBLIC.USERS PROFILE
     * -------------------------------------------------------
     */

    const profileUpdates: Record<
      string,
      unknown
    > = {
      auth_id: authId,
      name,
      full_name: name,
      email: authEmail,
      role,
      status,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    };

    if (isGlobalManager) {
      profileUpdates.branch_id = branchId;
    }

    const {
      data: updatedUser,
      error: profileError,
    } = await supabaseAdmin
      .from("users")
      .update(profileUpdates)
      .eq("id", id)
      .select(PROFILE_SELECT)
      .single();

    if (
      profileError ||
      !updatedUser
    ) {
      console.error(
        "[update-user] Profile update failed",
        {
          callerRole: caller.role,
          targetProfileId: id,
          targetAuthId: authId,
          oldRole: target.role,
          requestedRole: role,
          error:
            profileError?.message ||
            "No profile returned",
        },
      );

      return json(
        {
          success: false,
          error:
            `Auth was updated, but profile sync failed: ${
              profileError?.message ||
              "No profile returned"
            }`,
          passwordUpdated: Boolean(password),
          passwordVerified: false,
        },
        500,
      );
    }

    /*
     * -------------------------------------------------------
     * 12. VERIFY NEW PASSWORD
     * -------------------------------------------------------
     */

    let passwordVerified = false;

    if (password) {
      const verificationClient =
        createClient(
          supabaseUrl,
          anonKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
              detectSessionInUrl: false,
            },
          },
        );

      const {
        data: verificationData,
        error: verificationError,
      } =
        await verificationClient.auth.signInWithPassword(
          {
            email: authEmail,
            password,
          },
        );

      passwordVerified =
        !verificationError &&
        verificationData.user?.id === authId;

      await verificationClient.auth.signOut({
        scope: "local",
      });

      if (!passwordVerified) {
        console.error(
          "[update-user] Password verification failed",
          {
            targetProfileId: target.id,
            targetAuthId: authId,
            authEmail,
            error:
              verificationError?.message ||
              "Verified Auth user did not match",
          },
        );

        return json(
          {
            success: false,
            error:
              `Auth update returned successfully, but new-password verification failed: ${
                verificationError?.message ||
                "Auth user mismatch"
              }`,
            passwordUpdated: true,
            passwordVerified: false,
          },
          409,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * 13. SUCCESS
     * -------------------------------------------------------
     */

    console.log(
      "[update-user] User updated successfully",
      {
        callerAuthId: callerAuthUser.id,
        callerRole: caller.role,
        targetProfileId: target.id,
        targetAuthId: authId,
        oldRole: target.role,
        newRole: role,
        passwordUpdated: Boolean(password),
        passwordVerified,
      },
    );

    return json({
      success: true,
      user: updatedUser,
      passwordUpdated: Boolean(password),
      passwordVerified,
    });
  } catch (error) {
    console.error(
      "[update-user] Unhandled error",
      {
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
        passwordUpdated: false,
        passwordVerified: false,
      },
      500,
    );
  }
});
