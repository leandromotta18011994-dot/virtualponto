import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEntries, type Profile } from "@/lib/data";
import { dayKey, fmtDay, fmtMin, fmtTime, groupByDay, KIND_LABEL } from "@/lib/time";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular ${tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

export function BancoView({
  profile,
  canEdit,
  sinceDays = 31,
}: {
  profile: Profile;
  canEdit?: boolean;
  sinceDays?: number;
}) {
  const { data: entries = [], isLoading } = useEntries(profile.id, sinceDays);
  const qc = useQueryClient();
  const days     = groupByDay(entries, profile.daily_minutes);
  const todayKey = dayKey(new Date());
  const closed   = days.filter((d) => d.key !== todayKey || !d.open);
  const total    = closed.reduce((a, d) => a + d.balance, 0);
  const extra    = closed.reduce((a, d) => a + Math.max(0, d.balance), 0);
  const worked   = days.reduce((a, d) => a + d.worked, 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Registro removido"); qc.invalidateQueries({ queryKey: ["entries"] }); },
    onError: () => toast.error("Erro ao remover"),
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-ink p-5 text-ink-foreground">
        <p className="font-mono text-xs uppercase tracking-widest opacity-60">Saldo - ultimos {sinceDays} dias</p>
        <p className={`mt-1 font-mono text-5xl font-bold tabular ${total >= 0 ? "text-success" : "text-destructive"}`}>{fmtMin(total, true)}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Trabalhado"   value={fmtMin(worked)} />
        <Stat label="Horas extras" value={fmtMin(extra)} tone="pos" />
        <Stat label="Dias"         value={String(days.length)} />
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : days.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Sem registros no periodo.</p>
      ) : (
        <ul className="space-y-3">
          {days.map((d) => (
            <li key={d.key} className="rounded-xl border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold capitalize">{fmtDay(d.key)}</span>
                <span className={`font-mono text-sm font-semibold ${d.balance >= 0 ? "text-success" : "text-destructive"}`}>{fmtMin(d.balance, true)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Trabalhado {fmtMin(d.worked)} - Almoco {fmtMin(d.lunch)}{d.open ? " - em aberto" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {d.entries.map((e) => (
                  <span key={e.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                    {KIND_LABEL[e.kind]} <b className="font-mono">{fmtTime(e.recorded_at)}</b>
                    {e.edited_at && <span className="text-yellow-500 ml-0.5" title="Editado">(editado)</span>}
                    {canEdit && (
                      <button
                        aria-label="Remover registro"
                        onClick={() => { if (confirm("Remover este registro?")) del.mutate(e.id); }}
                        className="ml-1 text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
