import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ADMIN_EMAIL, toAuthPassword, toLoginEmail } from "./auth-creds";

// Public & idempotent: makes sure the fixed administrator account exists in the cloud.
export const ensureAdminAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list?.users.find((u) => u.email === ADMIN_EMAIL);
  if (!user) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: toAuthPassword("admin"),
      email_confirm: true,
      user_metadata: { full_name: "Administrador" },
    });
    if (error) throw new Error(error.message);
    user = data.user!;
  }
  await supabaseAdmin.from("user_roles").upsert(
    { user_id: user.id, role: "gestor" },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
  return { ok: true };
});

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      username: string;
      password: string;
      full_name: string;
      role: "gestor" | "funcionario";
      daily_minutes: number;
      lunch_minutes: number;
      monthly_salary: number;
      work_schedule_id: string | null;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    const { data: isGestor } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "gestor",
    });
    if (!isGestor) throw new Error("Apenas o administrador pode cadastrar usuários.");
    if (!data.username.trim() || data.password.length < 4) throw new Error("Usuário ou senha inválidos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: toLoginEmail(data.username),
      password: toAuthPassword(data.password),
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message.includes("already") ? "Esse usuário já existe." : error.message);
    const id = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({
      id,
      full_name: data.full_name,
      email: toLoginEmail(data.username),
      daily_minutes: data.daily_minutes,
      lunch_minutes: data.lunch_minutes,
      monthly_salary: data.monthly_salary,
      work_schedule_id: data.work_schedule_id,
      is_active: true,
    });
    if (data.role === "gestor") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: id, role: "gestor" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    }
    return { id };
  });
