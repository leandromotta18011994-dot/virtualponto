import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BancoView } from "@/components/BancoView";
import { useMe, type Profile } from "@/lib/data";
import { dayKey, fmtMin, groupByDay, type Entry } from "@/lib/time";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Banco de Horas" }, { name: "description", content: "Gestão de jornada e horas da equipe." }] }),
  component: Equipe,
});

function Equipe() {
  const { data: me } = useMe();
  const [selected, setSelected] = useState<Profile | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    enabled: !!me?.isGestor,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 31); since.setHours(0, 0, 0, 0);
      const [{ data: profiles }, { data: entries }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("time_entries").select("id,user_id,kind,recorded_at").gte("recorded_at", since.toISOString()),
      ]);
      return { profiles: (profiles ?? []) as Profile[], entries: (entries ?? []) as Entry[] };
    },
  });

  if (me && !me.isGestor) return <p className="px-5 pt-4 text-sm">Acesso restrito ao gestor.</p>;

  if (selected) {
    return (
      <main className="space-y-4 px-5 pt-4">
        <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Equipe
        </button>
        <h1 className="text-xl font-semibold">{selected.full_name}</h1>
        <JornadaForm profile={selected} onSaved={(p) => setSelected(p)} />
        <BancoView profile={selected} canEdit />
      </main>
    );
  }

  const today = dayKey(new Date());
  return (
    <main className="space-y-3 px-5 pt-4">
      <h1 className="text-xl font-semibold">Equipe</h1>
      <p className="text-sm text-muted-foreground">Novos funcionários aparecem aqui após criarem a conta.</p>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      <ul className="space-y-2">
        {data?.profiles.map((p) => {
          const days = groupByDay(data.entries.filter((e) => e.user_id === p.id), p.daily_minutes);
          const bal = days.filter((d) => d.key !== today || !d.open).reduce((a, d) => a + d.balance, 0);
          const t = days.find((d) => d.key === today);
          return (
            <li key={p.id}>
              <button onClick={() => setSelected(p)} className="flex w-full items-center justify-between rounded-xl border bg-card p-4 text-left">
                <div>
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Jornada {fmtMin(p.daily_minutes)} · {t ? (t.open ? "trabalhando agora" : `hoje ${fmtMin(t.worked)}`) : "sem registro hoje"}
                  </p>
                </div>
                <span className={`font-mono font-semibold ${bal >= 0 ? "text-success" : "text-destructive"}`}>{fmtMin(bal, true)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function JornadaForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const qc = useQueryClient();
  const [h, setH] = useState(profile.daily_minutes / 60);
  const [l, setL] = useState(profile.lunch_minutes);
  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .update({ daily_minutes: Math.round(h * 60), lunch_minutes: l }).eq("id", profile.id).select().single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (p) => { toast.success("Jornada atualizada"); qc.invalidateQueries(); onSaved(p); },
    onError: () => toast.error("Erro ao salvar"),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="flex items-end gap-3 rounded-xl border bg-card p-4">
      <label className="flex-1 text-xs text-muted-foreground">Jornada (h/dia)
        <input type="number" step="0.25" min="1" max="14" value={h} onChange={(e) => setH(Number(e.target.value))} className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-foreground" />
      </label>
      <label className="flex-1 text-xs text-muted-foreground">Almoço (min)
        <input type="number" min="0" max="240" value={l} onChange={(e) => setL(Number(e.target.value))} className="mt-1 w-full rounded-md border bg-background px-3 py-2 font-mono text-foreground" />
      </label>
      <button disabled={save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Salvar</button>
    </form>
  );
}
