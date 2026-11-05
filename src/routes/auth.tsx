import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar – Virtual Ponto" },
      { name: "description", content: "Acesse para registrar seu ponto ou gerenciar a equipe." },
    ],
  }),
  component: Auth,
});

const ADMIN_STORAGE_KEY = "vp_admin_credentials";

export function getStoredAdminCredentials() {
  if (typeof window === "undefined") return { username: "admin", email: "admin@admin.local", passwordHash: "admin" };
  const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
  if (!stored) {
    const defaultCreds = { username: "admin", email: "admin@admin.local", password: "admin" };
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(defaultCreds));
    return defaultCreds;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return { username: "admin", email: "admin@admin.local", password: "admin" };
  }
}

export function updateStoredAdminCredentials(username: string, email: string, password?: string) {
  const current = getStoredAdminCredentials();
  const updated = {
    username: username || current.username,
    email: email || current.email,
    password: password || current.password,
  };
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

function Auth() {
  const navigate = useNavigate();
  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword]     = useState("");
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    // Se já estiver autenticado (ou sessão local admin ativa)
    const localAdmin = localStorage.getItem("vp_is_admin_session");
    if (localAdmin === "true") {
      navigate({ to: "/admin" });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/ponto" });
    });

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/ponto" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const cleanInput = loginInput.trim();
    const adminCreds = getStoredAdminCredentials();

    // 1. CHECAGEM PRIORITÁRIA DE ADMIN (Permite entrada garantida como admin/admin inicial ou credenciais alteradas)
    const isAdminMatch =
      cleanInput.toLowerCase() === adminCreds.username.toLowerCase() ||
      cleanInput.toLowerCase() === adminCreds.email.toLowerCase() ||
      (cleanInput.toLowerCase() === "admin" && adminCreds.username === "admin");

    if (isAdminMatch && password === adminCreds.password) {
      // Login Admin Garantido!
      localStorage.setItem("vp_is_admin_session", "true");
      localStorage.setItem(
        "vp_current_user",
        JSON.stringify({
          id: "admin-root-id",
          full_name: "Administrador",
          email: adminCreds.email,
          role: "gestor",
          daily_minutes: 480,
          lunch_minutes: 60,
        })
      );

      // Tenta também autenticar no Supabase Auth em background se existir
      try {
        const loginEmail = adminCreds.email.includes("@") ? adminCreds.email : `${adminCreds.email}@admin.local`;
        await supabase.auth.signInWithPassword({ email: loginEmail, password });
      } catch {
        // Ignora caso ainda não tenha sido criado no Supabase Cloud
      }

      toast.success("Acesso Administrador liberado com sucesso!");
      navigate({ to: "/admin" });
      setLoading(false);
      return;
    }

    // 2. CHECAGEM DE FUNCIONÁRIOS / DEMAIS USUÁRIOS VIA SUPABASE
    const loginEmail = cleanInput.includes("@") ? cleanInput : `${cleanInput}@admin.local`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error || !data.user) {
      // Tenta verificar se é um funcionário criado localmente na lista de backup
      const localUsersRaw = localStorage.getItem("vp_team_profiles");
      if (localUsersRaw) {
        try {
          const list = JSON.parse(localUsersRaw);
          const found = list.find(
            (u: any) =>
              (u.email?.toLowerCase() === cleanInput.toLowerCase() ||
               u.username?.toLowerCase() === cleanInput.toLowerCase()) &&
              u.password === password
          );
          if (found) {
            localStorage.setItem("vp_current_user", JSON.stringify(found));
            localStorage.removeItem("vp_is_admin_session");
            toast.success(`Bem-vindo, ${found.full_name}!`);
            navigate({ to: "/ponto" });
            setLoading(false);
            return;
          }
        } catch {}
      }

      toast.error("Usuário ou senha inválidos.");
    } else {
      localStorage.removeItem("vp_is_admin_session");
      toast.success("Login realizado!");
      navigate({ to: "/ponto" });
    }

    setLoading(false);
  };

  const inp = "w-full rounded-lg border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">⏱ Virtual Ponto</p>
      <h1 className="mt-2 text-3xl font-bold">Bem-vindo</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acesse com seu usuário e senha.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Usuário ou E-mail</label>
          <input
            required
            autoComplete="username"
            placeholder="admin"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            className={inp}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Senha</label>
          <input
            required
            type="password"
            autoComplete="current-password"
            placeholder="admin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inp}
          />
        </div>
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60 transition"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground flex items-center gap-1.5">
          <span>🔑</span> Acesso Principal do Administrador:
        </p>
        <p>Usuário: <span className="font-mono font-bold text-foreground">admin</span></p>
        <p>Senha: <span className="font-mono font-bold text-foreground">admin</span></p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Após entrar como admin, configure os horários de expediente, cadastre os funcionários e altere sua senha na aba <strong>Configurações</strong>.
        </p>
      </div>
    </main>
  );
}
