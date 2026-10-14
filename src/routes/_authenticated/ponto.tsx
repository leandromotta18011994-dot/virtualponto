import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntries, useMe } from "@/lib/data";
import { dayKey, fmtMin, fmtTime, KIND_LABEL, nextKinds, summarizeDay, type EntryKind } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/ponto")({
  head: () => ({
    meta: [
      { title: "Registrar ponto — Banco de Horas" },
      { name: "description", content: "Registre entrada, almoço e saída e acompanhe suas horas trabalhadas e extras em tempo real." },
      { property: "og:title", content: "Registrar ponto — Banco de Horas" },
      { property: "og:description", content: "Bata o ponto, controle o almoço e acompanhe seu banco de horas." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://virtualponto.lovable.app/ponto" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Registrar ponto — Banco de Horas" },
      { name: "twitter:description", content: "Bata o ponto, controle o almoço e acompanhe seu banco de horas." },
    ],
    links: [{ rel: "canonical", href: "https://virtualponto.lovable.app/ponto" }],
  }),
  component: Ponto,
});

function Ponto() {
  const { data: me } = useMe();
  const { data: entries = [] } = useEntries(me?.user.id, 1);
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const today = entries.filter((e) => dayKey(e.recorded_at) === dayKey(now));
  const daily = me?.profile?.daily_minutes ?? 480;
  const s = summarizeDay(today, daily, now);
  const options = nextKinds(today);
  const primary = options[0]!;

  const punch = useMutation({
    mutationFn: async (kind: EntryKind) => {
      const { error } = await supabase.from("time_entries").insert({ kind, user_id: me!.user.id });
      if (error) throw error;
      return kind;
    },
    onSuccess: (k) => { toast.success(`${KIND_LABEL[k]} registrada`); qc.invalidateQueries({ queryKey: ["entries"] }); },
    onError: () => toast.error("Não foi possível registrar"),
  });

  const progress = Math.min(100, (s.worked / daily) * 100);
  const status = today.length === 0 ? "Fora do expediente" : s.open ? "Trabalhando" : options[0] === "volta_almoco" ? "Em almoço" : options[0] === "entrada" ? "Expediente encerrado" : "";

  return (
    <main className="space-y-6 px-5 pt-4">
      <section className="rounded-2xl bg-ink p-6 text-ink-foreground">
        <p className="font-mono text-xs uppercase tracking-widest opacity-60">
          {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </p>
        <p className="mt-2 font-mono text-6xl font-bold tabular">
          {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          <span className="text-2xl opacity-50">:{String(now.getSeconds()).padStart(2, "0")}</span>
        </p>
        <p className="mt-3 inline-flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${s.open ? "bg-success animate-pulse" : "bg-warning"}`} />
          {status}
        </p>
      </section>

      <section className="space-y-3">
        <button
          disabled={punch.isPending || !me}
          onClick={() => punch.mutate(primary)}
          className="punch-shadow active:punch-shadow-pressed w-full rounded-2xl bg-primary py-7 text-2xl font-bold text-primary-foreground transition active:translate-y-1 disabled:opacity-60"
        >
          Registrar {KIND_LABEL[primary]}
        </button>
        {options[1] && (
          <button
            disabled={punch.isPending}
            onClick={() => punch.mutate(options[1]!)}
            className="w-full rounded-xl border bg-card py-3 text-sm font-medium"
          >
            Encerrar sem almoço ({KIND_LABEL[options[1]!]})
          </button>
        )}
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Trabalhado" value={fmtMin(s.worked)} />
        <Stat label="Almoço" value={fmtMin(s.lunch)} />
        <Stat label="Saldo dia" value={fmtMin(s.balance, true)} tone={s.balance >= 0 ? "pos" : "neg"} />
      </section>

      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Jornada</span><span className="font-mono">{fmtMin(daily)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Registros de hoje</h2>
        {today.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ol className="divide-y rounded-xl border bg-card">
            {s.entries.map((e) => (
              <li key={e.id} className="flex justify-between px-4 py-3 text-sm">
                <span>{KIND_LABEL[e.kind]}</span>
                <span className="font-mono tabular">{fmtTime(e.recorded_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular ${tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
