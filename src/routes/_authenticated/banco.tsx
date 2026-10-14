import { createFileRoute } from "@tanstack/react-router";
import { BancoView } from "@/components/BancoView";
import { useMe } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/banco")({
  head: () => ({ meta: [{ title: "Meu banco de horas" }, { name: "description", content: "Saldo, horas extras e histórico de ponto." }] }),
  component: Banco,
});

function Banco() {
  const { data: me } = useMe();
  return (
    <main className="px-5 pt-4">
      {me?.profile ? <BancoView profile={me.profile} /> : <p className="text-sm text-muted-foreground">Carregando…</p>}
    </main>
  );
}
