import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL, toAuthPassword, toLoginEmail } from "@/lib/auth-creds";
import { ensureAdminAccount } from "@/lib/users.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar - Virtual Ponto" },
      { name: "description", content: "Acesse para registrar seu ponto ou gerenciar a equipe." },
    ],
  }),
  component: Auth,
});

const ADMIN_STORAGE_KEY = "vp_admin_credentials";

export function getStoredAdminCredentials() {
  if (typeof window === "undefined") return { username: "admin", email: "admin@admin.local", password: "admin" };
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

    localStorage.removeItem("vp_is_admin_session");
    localStorage.removeItem("vp_current_user");
    const email = toLoginEmail(loginInput);
    if (email === ADMIN_EMAIL) {
      try { await ensureAdminAccount(); } catch {}
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: toAuthPassword(password),
    });

    if (error || !data.user) {
      toast.error("Usuario ou senha invalidos.");
    } else {
      const { data: isGestor } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "gestor" });
      toast.success("Login realizado!");
      navigate({ to: isGestor ? "/admin" : "/ponto" });
    }

    setLoading(false);
  };

  const inp = "w-full rounded-lg border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Virtual Ponto</p>
      <h1 className="mt-2 text-3xl font-bold">Bem-vindo</h1>
      <p className="mt-1 text-sm text-muted-foreground">Acesse com seu usuario e senha.</p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Usuario</label>
          <input
            required
            autoComplete="username"
            placeholder="Usuario"
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
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inp}
          />
        </div>
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60 transition"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
