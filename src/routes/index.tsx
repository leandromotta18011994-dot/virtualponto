import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Coffee, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Banco de Horas - Controle de ponto da equipe" },
      { name: "description", content: "Registre entrada, almoco e saida e acompanhe horas trabalhadas e extras." },
      { property: "og:title", content: "Banco de Horas - Controle de ponto da equipe" },
      { property: "og:description", content: "Registre entrada, almoco e saida e acompanhe horas trabalhadas e extras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const items = [
    { icon: Clock, t: "Ponto em um toque", d: "Entrada e saida com horario do servidor." },
    { icon: Coffee, t: "Horário de almoço", d: "Pausa registrada e descontada automaticamente." },
    { icon: TrendingUp, t: "Horas extras", d: "Saldo diario e banco de horas acumulado." },
    { icon: Users, t: "Painel do gestor", d: "Jornada por funcionario e visao da equipe." },
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Ponto</p>
      <h1 className="mt-6 text-5xl font-bold leading-[1.05]">Cada minuto da equipe, no lugar certo.</h1>
      <p className="mt-4 text-muted-foreground">Banco de horas, almoco e horas extras sem planilha.</p>
      <Link to="/ponto" className="punch-shadow mt-8 rounded-2xl bg-primary py-5 text-center text-lg font-bold text-primary-foreground">
        Registrar ponto
      </Link>
      <ul className="mt-12 grid grid-cols-2 gap-3">
        {items.map(({ icon: I, t, d }) => (
          <li key={t} className="rounded-xl border bg-card p-4">
            <I className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">{t}</p>
            <p className="mt-1 text-xs text-muted-foreground">{d}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
