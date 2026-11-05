import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar – Virtual Ponto" }, { name: "description", content: "Acesse para registrar seu ponto." }] }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/ponto" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: "/ponto" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Permite login com apelido (sem "@") mapeando para @admin.local
    const loginEmail = email.includes("@") ? email : `${email}@admin.local`;
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) toast.error("Usuário ou senha inválidos");
    setLoading(false);
  };

  const inp = "w-full rounded-lg border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">⏱ Virtual Ponto</p>
      <h1 className="mt-2 text-3xl font-bold">Bem-vindo de volta</h1>
      <p className="mt-1 text-sm text-muted-foreground">Entre com seu usuário e senha.</p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          required
          autoComplete="username"
          placeholder="Usuário ou e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inp}
        />
        <input
          required
          type="password"
          minLength={4}
          autoComplete="current-password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inp}
        />
        <button
          disabled={loading}
          className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="mt-6 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">Acesso padrão do administrador:</p>
        <p>Usuário: <span className="font-mono font-medium text-foreground">admin</span></p>
        <p>Senha: <span className="font-mono font-medium text-foreground">admin</span></p>
        <p className="mt-1 text-[11px]">Altere as credenciais em <strong>Admin → Config.</strong> após o primeiro acesso.</p>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Não possui acesso? Solicite ao administrador.
      </p>
    </main>
  );
}
