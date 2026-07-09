declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};


// @ts-ignore: External ESM import without local type declarations
import { serve } from "https://deno.land/std/http/server.ts";// @ts-ignore: External ESM import without local type declarations
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {

  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      email,
      password,
      name,
      role,
      phone,
      status,
      branch_id,
    } = body;

    // Create Auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Create profile
    const { data, error } = await supabase
      .from("users")
      .insert({
        auth_id: authData.user.id,
        name,
        full_name: name,
        email,
        password,
        role,
        phone,
        status,
        branch_id,
      })
      .select()
      .single();

    if (error) {
      await supabase.auth.admin.deleteUser(authData.user.id);

      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (err) {

    console.log("CREATE USER ERROR:", err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  }
});