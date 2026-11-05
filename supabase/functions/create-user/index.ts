// Edge Function: create-user
// Permite que o gestor crie usuários sem encerrar sua própria sessão.
// Usa a Service Role Key server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado" }, 401);
    }

    // Verifica se o caller é gestor
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const { data: roles } = await caller
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roles?.some((r: { role: string }) => r.role === "gestor")) {
      return json({ error: "Apenas o administrador pode criar usuários." }, 403);
    }

    const { email, password, full_name, role = "funcionario" } = await req.json();
    if (!email || !password || !full_name) {
      return json({ error: "email, password e full_name são obrigatórios." }, 400);
    }

    // Cria usuário com admin API (não afeta sessão do caller)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,          // ativa imediatamente, sem confirmar email
      user_metadata: { full_name },
    });

    if (error) return json({ error: error.message }, 400);

    // Atribui role
    if (data.user) {
      await admin.from("user_roles").insert({ user_id: data.user.id, role });
    }

    return json({ user: { id: data.user?.id, email, full_name } }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

