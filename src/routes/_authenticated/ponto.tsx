import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntries, useMe, addOfflineEntry } from "@/lib/data";
import { dayKey, fmtMin, fmtTime, KIND_LABEL, nextKinds, summarizeDay, type EntryKind } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/ponto")({
  head: () => ({
    meta: [
      { title: "Registrar ponto - Banco de Horas" },
      { name: "description", content: "Registre entrada, almoco e saida e acompanhe suas horas trabalhadas e extras em tempo real." },
    ],
  }),
  component: Ponto,
});

function Ponto() {
  const { data: me } = useMe();
  const { data: entries = [] } = useEntries(me?.user.id, 1);
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const today   = entries.filter((e) => dayKey(e.recorded_at) === dayKey(now));
  const daily   = me?.profile?.daily_minutes ?? 480;
  const s       = summarizeDay(today, daily, now);
  const options = nextKinds(today);
  const primary = options[0]!;

  const punch = useMutation({
    mutationFn: async (kind: EntryKind) => {
      const recorded_at = new Date().toISOString();
      const userId = me!.user.id;

      // Se estiver offline ou falhar na rede, salva localmente na fila de sincronizacao
      if (!navigator.onLine) {
        addOfflineEntry({
          id: "offline_" + Date.now(),
          user_id: userId,
          kind,
          recorded_at,
          note: "[Registrado Offline]",
        });
        return { kind, offline: true };
      }

      try {
        const { error } = await supabase.from("time_entries").insert({ kind, user_id: userId, recorded_at });
        if (error) throw error;
        return { kind, offline: false };
      } catch (err) {
        // Fallback offline caso perca conexao no momento do envio
        addOfflineEntry({
          id: "offline_" + Date.now(),
          user_id: userId,
          kind,
          recorded_at,
          note: "[Registrado Offline]",
        });
        return { kind, offline: true };
      }
    },
    onSuccess: (res) => {
      if (res.offline) {
        toast.info(`${KIND_LABEL[res.kind]} salva offline! Sera enviada quando houver internet.`);
      } else {
        toast.success(`${KIND_LABEL[res.kind]} registrada com sucesso`);
      }
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["team_entries"] });
    },
    onError: () => toast.error("Nao foi possivel registrar"),
  });

  const progress = Math.min(100, (s.worked / daily) * 100);
  const status   =
    today.length === 0       ? "Fora do expediente" :
    s.open                   ? "Trabalhando" :
    options[0] === "volta_almoco" ? "Em almoco" :
    options[0] === "entrada"      ? "Expediente encerrado" : "";

  return (
    <main className="space-y-6 px-5 pt-4">
      {/* Relogio */}
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

      {/* Botao principal */}
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
            Encerrar sem almoco ({KIND_LABEL[options[1]!]})
          </button>
        )}
      </section>

      {/* Stats do dia */}
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Trabalhado" value={fmtMin(s.worked)} />
        <Stat label="Almoco"     value={fmtMin(s.lunch)} />
        <Stat label="Saldo dia"  value={fmtMin(s.balance, true)} tone={s.balance >= 0 ? "pos" : "neg"} />
      </section>

      {/* Barra de progresso */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Jornada</span>
          <span className="font-mono">{fmtMin(daily)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Registros de hoje */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Registros de hoje</h2>
          <button
            title="Atualizar registros"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["entries"] });
              toast.success("Registros atualizados!");
            }}
            className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {today.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum registro ainda.</p>
        ) : (
          <ol className="divide-y rounded-xl border bg-card">
            {s.entries.map((e) => (
              <li key={e.id} className="flex justify-between px-4 py-3 text-sm">
                <span className="flex items-center gap-2">
                  {KIND_LABEL[e.kind]}
                  {e.edited_at && <span className="text-xs text-yellow-500">✎ editado</span>}
                  {e.note?.includes("Offline") && <span className="text-xs text-blue-500">☁ offline pendente</span>}
                </span>
                <span className="font-mono tabular">{fmtTime(e.recorded_at)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Saldo acumulado */}
      {me?.profile && s.balance !== 0 && (
        <div className={`rounded-xl p-4 text-center text-sm font-medium ${s.balance > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
          {s.balance > 0
            ? `+${fmtMin(s.balance)} de horas extras hoje!`
            : `${fmtMin(s.balance, true)} de horas devedoras hoje.`}
        </div>
      )}
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
