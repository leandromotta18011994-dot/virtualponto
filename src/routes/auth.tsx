import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Banco de Horas" }, { name: "description", content: "Acesse para registrar seu ponto." }] }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/ponto" }); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (s) navigate({ to: "/ponto" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("E-mail ou senha inválidos");
    } else {
      const { error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Confirme pelo link enviado ao seu e-mail.");
    }
    setLoading(false);
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Falha ao entrar com Google");
  };

  const input = "w-full rounded-lg border bg-card px-4 py-3";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">● Ponto</p>
      <h1 className="mt-2 text-3xl font-bold">{mode === "in" ? "Bem-vindo de volta" : "Criar conta"}</h1>
      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "up" && <input required placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} className={input} />}
        <input required type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        <input required type="password" minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        <button disabled={loading} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
          {mode === "in" ? "Entrar" : "Cadastrar"}
        </button>
      </form>
      <button onClick={google} className="mt-3 w-full rounded-lg border bg-card py-3 font-medium">Continuar com Google</button>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-6 text-sm text-muted-foreground">
        {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
      </button>
    </main>
  );
}
