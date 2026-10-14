import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, CalendarDays, Users, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Layout,
});

function Layout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const item = "flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground";
  const active = { className: "!text-primary font-semibold" };
  return (
    <div className="mx-auto min-h-screen max-w-xl pb-24">
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Banco de Horas</p>
          <p className="text-lg font-semibold">{me?.profile?.full_name || "…"}</p>
        </div>
        <button onClick={signOut} aria-label="Sair" className="rounded-full border p-2 text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
        </button>
      </header>
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          <Link to="/ponto" className={item} activeProps={active}><Clock className="h-5 w-5" />Ponto</Link>
          <Link to="/banco" className={item} activeProps={active}><CalendarDays className="h-5 w-5" />Banco</Link>
          {me?.isGestor && (
            <Link to="/equipe" className={item} activeProps={active}><Users className="h-5 w-5" />Equipe</Link>
          )}
        </div>
      </nav>
    </div>
  );
}
