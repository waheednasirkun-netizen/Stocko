import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.35.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, password, role, status, phone, branch_id } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Name, email, and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

    // Create auth user
    const { data: authData, error: authError } =
  await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role,
      status,
      phone,
      branch_id,
    },
  });
    if (authError) {
      return new Response(
        JSON.stringify({ success: false, error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into public.users table
    // Update the user row created by the auth trigger
   // Update the row that was automatically created by handle_new_user()
  const { data: userData, error: dbError } = await supabase
  .from("users")
  .update({
    name,
    full_name: name,
    role,
    status,
    phone: phone || null,
    branch_id: branch_id || null,
  })
  .eq("id", authData.user.id)
  .select()
  .single();

    if (dbError) {
      // Rollback: delete auth user if DB insert fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({ success: false, error: dbError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});