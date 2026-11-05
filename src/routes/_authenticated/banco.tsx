import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BancoView } from "@/components/BancoView";
import { useMe } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/banco")({
  head: () => ({ meta: [{ title: "Meu banco de horas" }, { name: "description", content: "Saldo, horas extras e histórico de ponto." }] }),
  component: Banco,
});

type Period = "7" | "15" | "31" | "60" | "90";

function Banco() {
  const { data: me } = useMe();
  const [period, setPeriod] = useState<Period>("31");

  const periods: { id: Period; label: string }[] = [
    { id: "7",  label: "7 dias"  },
    { id: "15", label: "15 dias" },
    { id: "31", label: "Mês"     },
    { id: "60", label: "2 meses" },
    { id: "90", label: "3 meses" },
  ];

  return (
    <main className="px-5 pt-4 space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {periods.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {me?.profile
        ? <BancoView profile={me.profile} sinceDays={Number(period) as 7 | 15 | 31 | 60 | 90} />
        : <p className="text-sm text-muted-foreground">Carregando…</p>
      }
    </main>
  );
}
