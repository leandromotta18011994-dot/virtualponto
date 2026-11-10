import { useServerFn } from "@tanstack/react-start";
import { createEmployee } from "@/lib/users.functions";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, Settings, Clock, History, TrendingUp,
  DollarSign, Plus, Pencil, Trash2, X, Check, Eye, EyeOff,
  Download, Database, Mail, RefreshCw
 Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useMe, useAllProfiles, useWorkSchedules, useTeamEntries,
  type Profile, type WorkSchedule,
} from "@/lib/data";
import {
  dayKey, fmtMin, fmtTime, fmtBRL, groupByDay, KIND_LABEL,
  getBusinessDays, calcSalary, monthLabel, type Entry, type EntryKind,
} from "@/lib/time";
import { toAuthPassword } from "@/lib/auth-creds";
import { exportEntriesPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin - Virtual Ponto" }] }),
  component: AdminPanel,
});

type Tab = "painel" | "usuarios" | "horarios" | "historico" | "gestao" | "salario" | "backup" | "config";

function AdminPanel() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<Tab>("painel");

  if (me && !me.isGestor) {
    return <p className="px-5 pt-6 text-sm text-muted-foreground">Acesso restrito ao administrador.</p>;
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "painel",    label: "Painel",   icon: LayoutDashboard },
    { id: "usuarios",  label: "Usuários", icon: Users },
    { id: "horarios",  label: "Escalas",  icon: Clock },
    { id: "historico", label: "Horários", icon: History },
    { id: "gestao",    label: "Gestão",   icon: TrendingUp },
    { id: "salario",   label: "Salário",  icon: DollarSign },
    { id: "backup",    label: "Backup",   icon: Database },
    { id: "config",    label: "Config",   icon: Settings },
  ];

  return (
    <main className="min-h-screen space-y-4 px-5 pt-4 pb-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Administrador</p>
        <h1 className="text-xl font-semibold">Painel de Controle</h1>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "painel"    && <PainelTab />}
      {tab === "usuarios"  && <UsuariosTab />}
      {tab === "horarios"  && <HorariosTab />}
      {tab === "historico" && <HistoricoTab />}
      {tab === "gestao"    && <GestaoTab />}
      {tab === "salario"   && <SalarioTab />}
      {tab === "backup"    && <BackupTab />}
      {tab === "config"    && <ConfigTab />}
    </main>
  );
}

// ─── PAINEL ──────────────────────────────────────────────────────────────────

function PainelTab() {
  const { data: profiles = [] } = useAllProfiles();
  const { data: entries = [] }  = useTeamEntries(1);
  const today = dayKey(new Date());
  const todayEntries = entries.filter((e) => dayKey(e.recorded_at) === today);
  const workingNow = profiles.filter((p) => {
    const pe = todayEntries.filter((e) => e.user_id === p.id);
    const last = [...pe].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).at(-1);
    return last?.kind === "entrada" || last?.kind === "volta_almoco";
  });
  const withRecord = new Set(todayEntries.map((e) => e.user_id)).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Funcionários"      value={String(profiles.length)}              sub="cadastrados" />
        <StatCard label="Trabalhando agora"  value={String(workingNow.length)}           sub="online hoje"  color="success" />
        <StatCard label="Com registro hoje"  value={String(withRecord)}                  sub="registros" />
        <StatCard label="Sem registro"       value={String(profiles.length - withRecord)} sub="ausentes"    color="warn" />
      </div>
      <section className="rounded-xl border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold">Equipe hoje</h2>
        {profiles.length === 0 && <p className="text-xs text-muted-foreground">Nenhum funcionario cadastrado.</p>}
        <ul className="divide-y">
          {profiles.map((p) => {
            const pe = todayEntries.filter((e) => e.user_id === p.id);
            const last = [...pe].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).at(-1);
            const online = last?.kind === "entrada" || last?.kind === "volta_almoco";
            const lunch  = last?.kind === "saida_almoco";
            return (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>{p.full_name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  online ? "bg-success/15 text-success" :
                  lunch  ? "bg-yellow-500/15 text-yellow-600" :
                  pe.length > 0 ? "bg-muted text-muted-foreground" :
                  "bg-destructive/10 text-destructive"
                }`}>
                  {online ? "Trabalhando" : lunch ? "Almoco" : pe.length > 0 ? "Encerrado" : "Sem registro"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ─── USUARIOS ─────────────────────────────────────────────────────────────────

function UsuariosTab() {
  const { data: profiles = [], isLoading } = useAllProfiles();
  const { data: schedules = [] }           = useWorkSchedules();
  const qc = useQueryClient();
  const emptyForm = { full_name: "", email: "", password: "", role: "funcionario", daily_minutes: 480, lunch_minutes: 60, monthly_salary: 0, work_schedule_id: "" };
  const [showForm, setShowForm]     = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [showPass, setShowPass]     = useState(false);
  const createEmployeeFn = useServerFn(createEmployee);

  const openCreate = () => { setForm(emptyForm); setEditProfile(null); setShowForm(true); };
  const openEdit = (p: Profile) => {
    setForm({ full_name: p.full_name, email: p.email ?? "", password: "", role: "funcionario", daily_minutes: p.daily_minutes, lunch_minutes: p.lunch_minutes, monthly_salary: p.monthly_salary, work_schedule_id: p.work_schedule_id ?? "" });
    setEditProfile(p);
    setShowForm(true);
  };

  const createUser = useMutation({
    mutationFn: async () => {
      await createEmployeeFn({
        data: {
          username: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role === "gestor" ? "gestor" : "funcionario",
          daily_minutes: form.daily_minutes,
          lunch_minutes: form.lunch_minutes,
          monthly_salary: form.monthly_salary,
          work_schedule_id: form.work_schedule_id || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Usuário criado.");
      qc.invalidateQueries({ queryKey: ["profiles"] });
      setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao criar usuario"),
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editProfile) return;
      try {
        await supabase.from("profiles").update({ full_name: form.full_name, daily_minutes: form.daily_minutes, lunch_minutes: form.lunch_minutes, monthly_salary: form.monthly_salary, work_schedule_id: form.work_schedule_id || null }).eq("id", editProfile.id);
      } catch {}

      const stored = localStorage.getItem("vp_team_profiles");
      if (stored) {
        const list = JSON.parse(stored).map((p: any) =>
          p.id === editProfile.id
            ? { ...p, full_name: form.full_name, daily_minutes: form.daily_minutes, lunch_minutes: form.lunch_minutes, monthly_salary: form.monthly_salary, work_schedule_id: form.work_schedule_id || null }
            : p
        );
        localStorage.setItem("vp_team_profiles", JSON.stringify(list));
      }
    },
    onSuccess: () => { toast.success("Perfil atualizado!"); qc.invalidateQueries({ queryKey: ["profiles"] }); setShowForm(false); },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from("profiles").delete().eq("id", id);
      } catch {}

      const stored = localStorage.getItem("vp_team_profiles");
      if (stored) {
        const list = JSON.parse(stored).filter((p: any) => p.id !== id);
        localStorage.setItem("vp_team_profiles", JSON.stringify(list));
      }
    },
    onSuccess: () => {
      toast.success("Usuário excluído.");
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: () => toast.error("Erro ao excluir usuario"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      try {
        await supabase.from("profiles").update({ is_active }).eq("id", id);
      } catch {}

      const stored = localStorage.getItem("vp_team_profiles");
      if (stored) {
        const list = JSON.parse(stored).map((p: any) => p.id === id ? { ...p, is_active } : p);
        localStorage.setItem("vp_team_profiles", JSON.stringify(list));
      }
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["profiles"] }); },
    onError: () => toast.error("Erro"),
  });

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowForm(false); setEditProfile(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          <h2 className="font-semibold">{editProfile ? "Editar usuário" : "Novo usuário"}</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); editProfile ? updateProfile.mutate() : createUser.mutate(); }} className="space-y-3">
          <Field label="Nome completo">
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inp} placeholder="Joao Silva" />
          </Field>
          {!editProfile && (
            <>
              <Field label="Usuário (login ou e-mail)">
                <input required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} placeholder="joao  ou  joao@empresa.com" />
              </Field>
              <Field label="Senha">
                <div className="relative">
                  <input required minLength={4} type={showPass ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inp + " pr-10"} placeholder="••••••" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Cargo">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp}>
                  <option value="funcionario">Funcionario</option>
                  <option value="gestor">Administrador</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Configuracao de horario">
            <select value={form.work_schedule_id} onChange={(e) => { const ws = schedules.find((s) => s.id === e.target.value); setForm({ ...form, work_schedule_id: e.target.value, daily_minutes: ws?.daily_minutes ?? form.daily_minutes, lunch_minutes: ws?.lunch_minutes ?? form.lunch_minutes }); }} className={inp}>
              <option value="">- Personalizado -</option>
              {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jornada (h/dia)">
              <input type="number" step="0.25" min="1" max="14" value={form.daily_minutes / 60} onChange={(e) => setForm({ ...form, daily_minutes: Math.round(Number(e.target.value) * 60), work_schedule_id: "" })} className={inp} />
            </Field>
            <Field label="Almoco (min)">
              <input type="number" min="0" max="240" value={form.lunch_minutes} onChange={(e) => setForm({ ...form, lunch_minutes: Number(e.target.value), work_schedule_id: "" })} className={inp} />
            </Field>
          </div>
          <Field label="Salário mensal (R$)">
            <input type="number" min="0" step="0.01" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: Number(e.target.value) })} className={inp} />
          </Field>
          <button disabled={createUser.isPending || updateProfile.isPending} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
            {createUser.isPending || updateProfile.isPending ? "Salvando..." : editProfile ? "Salvar alteracoes" : "Criar usuario"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Usuários cadastrados</h2>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Novo
        </button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && profiles.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum usuario cadastrado.</p>
      )}
      <ul className="space-y-2">
        {profiles.map((p) => (
          <li key={p.id} className={`rounded-xl border bg-card p-4 ${!p.is_active ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{p.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                <p className="text-xs text-muted-foreground">Jornada {fmtMin(p.daily_minutes)} - Salario {fmtBRL(p.monthly_salary)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(p)} className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button title="Excluir usuário" onClick={() => { if (confirm(`Tem certeza que deseja excluir o cadastro de ${p.full_name}?`)) deleteProfile.mutate(p.id); }} className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10 transition">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button title={p.is_active ? "Desativar" : "Ativar"} onClick={() => toggleActive.mutate({ id: p.id, is_active: !p.is_active })} className={`rounded-md border p-1.5 ${p.is_active ? "text-muted-foreground" : "text-success"}`}>
                  {p.is_active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── ESCALAS DE EXPEDIENTE ───────────────────────────────────────────────────

function HorariosTab() {
  const { data: schedules = [], isLoading } = useWorkSchedules();
  const qc = useQueryClient();
  const blank = { name: "", entry_time: "08:00", lunch_start: "12:00", lunch_end: "13:00", exit_time: "17:00" };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<WorkSchedule | null>(null);
  const [form, setForm]         = useState(blank);

  function calcMinutes(entry: string, exit: string, ls: string, le: string) {
    const toMin = (t: string) => { const [h = 0, m = 0] = t.split(":").map(Number); return h * 60 + m; };
    return { daily: Math.max(0, toMin(exit) - toMin(entry) - (toMin(le) - toMin(ls))), lunch: Math.max(0, toMin(le) - toMin(ls)) };
  }

  const save = useMutation({
    mutationFn: async () => {
      const { daily, lunch } = calcMinutes(form.entry_time, form.exit_time, form.lunch_start, form.lunch_end);
      const payload = { name: form.name, entry_time: form.entry_time, lunch_start: form.lunch_start, lunch_end: form.lunch_end, exit_time: form.exit_time, daily_minutes: daily, lunch_minutes: lunch };
      
      try {
        if (editing) {
          await supabase.from("work_schedules").update(payload).eq("id", editing.id);
        } else {
          await supabase.from("work_schedules").insert(payload);
        }
      } catch {}

      const stored = localStorage.getItem("vp_work_schedules");
      let list: WorkSchedule[] = stored ? JSON.parse(stored) : [];
      if (editing) {
        list = list.map((s) => s.id === editing.id ? { ...s, ...payload } : s);
      } else {
        list.push({ id: "ws_" + Date.now(), ...payload, created_at: new Date().toISOString() });
      }
      localStorage.setItem("vp_work_schedules", JSON.stringify(list));
    },
    onSuccess: () => {
      toast.success("Configuracao salva com sucesso!");
      qc.invalidateQueries({ queryKey: ["work_schedules"] });
      setShowForm(false);
      setEditing(null);
    },
    onError: () => toast.error("Erro ao salvar configuracao"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      try {
        await supabase.from("work_schedules").delete().eq("id", id);
      } catch {}
      const stored = localStorage.getItem("vp_work_schedules");
      if (stored) {
        const list = JSON.parse(stored).filter((s: any) => s.id !== id);
        localStorage.setItem("vp_work_schedules", JSON.stringify(list));
      }
    },
    onSuccess: () => { toast.success("Configuracao removida!"); qc.invalidateQueries({ queryKey: ["work_schedules"] }); },
    onError: () => toast.error("Erro ao excluir"),
  });

  if (showForm) {
    const { daily, lunch } = calcMinutes(form.entry_time, form.exit_time, form.lunch_start, form.lunch_end);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          <h2 className="font-semibold">{editing ? "Editar escala" : "Nova escala"}</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <Field label="Nome da Escala (ex: Comercial, Turno Integral)">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inp} placeholder="Padrao" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entrada">     <input type="time" required value={form.entry_time}  onChange={(e) => setForm({ ...form, entry_time: e.target.value })}  className={inp} /></Field>
            <Field label="Saida">       <input type="time" required value={form.exit_time}   onChange={(e) => setForm({ ...form, exit_time: e.target.value })}   className={inp} /></Field>
            <Field label="Saida almoco"><input type="time" required value={form.lunch_start} onChange={(e) => setForm({ ...form, lunch_start: e.target.value })} className={inp} /></Field>
            <Field label="Volta almoco"><input type="time" required value={form.lunch_end}   onChange={(e) => setForm({ ...form, lunch_end: e.target.value })}   className={inp} /></Field>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <p>Jornada calculada: <strong>{fmtMin(daily)}</strong></p>
            <p>Almoco: <strong>{fmtMin(lunch)}</strong></p>
          </div>
          <button disabled={save.isPending} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
            {save.isPending ? "Salvando..." : "Salvar Configuracao"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Escalas de trabalho</h2>
        <button onClick={() => { setForm(blank); setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Adicionar Escala
        </button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && schedules.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma configuracao cadastrada.</p>}
      <ul className="space-y-2">
        {schedules.map((s) => (
          <li key={s.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.entry_time} ate {s.exit_time} - Almoco {s.lunch_start} as {s.lunch_end} ({fmtMin(s.daily_minutes)}/dia)</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setForm({ name: s.name, entry_time: s.entry_time, lunch_start: s.lunch_start, lunch_end: s.lunch_end, exit_time: s.exit_time }); setEditing(s); setShowForm(true); }} className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => { if (confirm("Remover esta escala de horario?")) del.mutate(s.id); }} className="rounded-md border p-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── HISTÓRICO & PONTOS DOS TÉCNICOS ──────────────────────────────────────────

function HistoricoTab() {
  const { data: profiles = [] }           = useAllProfiles();
  const { data: allEntries = [], isLoading } = useTeamEntries(60);
  const qc = useQueryClient();
  const [userId, setUserId]       = useState("all");
  const [period, setPeriod]       = useState<"today" | "week" | "month" | "all">("today");

  const [editingEntry, setEdit]   = useState<Entry | null>(null);
  const [editTime, setEditTime]   = useState("");
  const [editNote, setEditNote]   = useState("");

  const [showAddForm, setShowAdd] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addKind, setAddKind]     = useState<EntryKind>("entrada");
  const [addDate, setAddDate]     = useState(dayKey(new Date()));
  const [addTime, setAddTime]     = useState("08:00");
  const [addNote, setAddNote]     = useState("");

  const filtered = (() => {
    let entries = userId === "all" ? allEntries : allEntries.filter((e) => e.user_id === userId);
    const now = new Date();
    if (period === "today")
      entries = entries.filter((e) => dayKey(e.recorded_at) === dayKey(now));
    else if (period === "week") {
      const ago = new Date(now); ago.setDate(ago.getDate() - 7);
      entries = entries.filter((e) => new Date(e.recorded_at) >= ago);
    } else if (period === "month")
      entries = entries.filter((e) => { const d = new Date(e.recorded_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    return entries;
  })();

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!addUserId) throw new Error("Selecione o funcionário.");
      const [h = 0, m = 0] = addTime.split(":").map(Number);
      const [y = 1970, mon = 1, d = 1] = addDate.split("-").map(Number);
      const recorded = new Date(y, mon - 1, d, h, m, 0).toISOString();

      const newEntry: Entry = {
        id: crypto.randomUUID(),
        user_id: addUserId,
        kind: addKind,
        recorded_at: recorded,
        edited_at: new Date().toISOString(),
        note: addNote ? `[Admin: ${addNote}]` : "[Criado pelo Admin]",
      };

      try {
        await supabase.from("time_entries").insert({
          id: newEntry.id,
          user_id: newEntry.user_id,
          kind: newEntry.kind,
          recorded_at: newEntry.recorded_at,
          edited_at: newEntry.edited_at ?? null,
          note: newEntry.note ?? null,
        });
      } catch {}

      const stored = localStorage.getItem("vp_all_time_entries");
      const list: Entry[] = stored ? JSON.parse(stored) : [];
      list.unshift(newEntry);
      localStorage.setItem("vp_all_time_entries", JSON.stringify(list));

      const userEntries = localStorage.getItem(`vp_entries_${addUserId}`);
      const ulist: Entry[] = userEntries ? JSON.parse(userEntries) : [];
      ulist.unshift(newEntry);
      localStorage.setItem(`vp_entries_${addUserId}`, JSON.stringify(ulist));
    },
    onSuccess: () => {
      toast.success("Horário adicionado.");
      qc.invalidateQueries({ queryKey: ["team_entries"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
      setShowAdd(false);
      setAddNote("");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível adicionar o horário."),
  });

  const editEntry = useMutation({
    mutationFn: async () => {
      if (!editingEntry) return;
      const base = new Date(editingEntry.recorded_at);
      const [h = 0, m = 0] = editTime.split(":").map(Number);
      base.setHours(h, m, 0, 0);
      const updatedRecordedAt = base.toISOString();
      const updatedNote = editNote ? `[Editado: ${editNote}]` : "[Editado pelo Admin]";

      try {
        await supabase.from("time_entries").update({
          recorded_at: updatedRecordedAt,
          edited_at: new Date().toISOString(),
          note: updatedNote,
        }).eq("id", editingEntry.id);
      } catch {}

      const updateList = (key: string) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw).map((e: Entry) =>
            e.id === editingEntry.id
              ? { ...e, recorded_at: updatedRecordedAt, edited_at: new Date().toISOString(), note: updatedNote }
              : e
          );
          localStorage.setItem(key, JSON.stringify(list));
        }
      };
      updateList("vp_all_time_entries");
      updateList(`vp_entries_${editingEntry.user_id}`);
    },
    onSuccess: () => {
      toast.success("Horário corrigido.");
      qc.invalidateQueries({ queryKey: ["team_entries"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
      setEdit(null);
    },
    onError: () => toast.error("Não foi possível corrigir o horário."),
  });

  const delEntry = useMutation({
    mutationFn: async (entry: Entry) => {
      try {
        await supabase.from("time_entries").delete().eq("id", entry.id);
      } catch {}

      const removeList = (key: string) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw).filter((e: Entry) => e.id !== entry.id);
          localStorage.setItem(key, JSON.stringify(list));
        }
      };
      removeList("vp_all_time_entries");
      removeList(`vp_entries_${entry.user_id}`);
    },
    onSuccess: () => {
      toast.success("Registro removido.");
      qc.invalidateQueries({ queryKey: ["team_entries"] });
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
    onError: () => toast.error("Não foi possível remover o registro."),
  });

  const pName = (uid: string) => profiles.find((p) => p.id === uid)?.full_name ?? uid.slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Horários dos funcionários</h2>
        <div className="flex items-center gap-2">
          <button
            title="Atualizar registros"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["team_entries"] });
              qc.invalidateQueries({ queryKey: ["entries"] });
              qc.invalidateQueries({ queryKey: ["profiles"] });
              toast.success("Registros atualizados.");
            }}
            className="rounded-lg border p-2 text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (filtered.length === 0) { toast.error("Não há registros para exportar."); return; }
              exportEntriesPdf(filtered, pName, { today: "Hoje", week: "Últimos 7 dias", month: "Mês atual", all: "Todo o período" }[period]);
            }}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" /> Baixar PDF
          </button>
          <button
            onClick={() => {
              setAddUserId(profiles[0]?.id ?? "");
              setShowAdd(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar Ponto
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inp + " flex-1 min-w-0 py-2"}>
          <option value="all">Todos os funcionários</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <div className="flex gap-1">
          {(["today", "week", "month", "all"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`rounded-md px-2.5 py-2 text-xs font-medium ${period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {{ today: "Hoje", week: "Semana", month: "Mês", all: "Tudo" }[p]}
            </button>
          ))}
        </div>
      </div>

      {showAddForm && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Adicionar horário</p>
            <button onClick={() => setShowAdd(false)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          <Field label="Funcionário">
            <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} className={inp}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de ponto">
              <select value={addKind} onChange={(e) => setAddKind(e.target.value as EntryKind)} className={inp}>
                <option value="entrada">Entrada</option>
                <option value="saida_almoco">Saída para almoço</option>
                <option value="volta_almoco">Volta do almoço</option>
                <option value="saida">Saída</option>
              </select>
            </Field>
            <Field label="Data">
              <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className={inp} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Horário">
              <input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className={inp} />
            </Field>
            <Field label="Motivo">
              <input value={addNote} onChange={(e) => setAddNote(e.target.value)} className={inp} placeholder="Ex: Esqueceu de bater" />
            </Field>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowAdd(false)} className="flex-1 rounded-lg border py-2 text-sm">Cancelar</button>
            <button disabled={addEntry.isPending || !addUserId} onClick={() => addEntry.mutate()} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {addEntry.isPending ? "Salvando..." : "Adicionar Ponto"}
            </button>
          </div>
        </div>
      )}

      {editingEntry && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 shadow-md">
          <p className="font-semibold text-sm">Corrigir horário - {KIND_LABEL[editingEntry.kind]}</p>
          <Field label="Novo horário">
            <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className={inp} />
          </Field>
          <Field label="Motivo da correção">
            <input value={editNote} onChange={(e) => setEditNote(e.target.value)} className={inp} placeholder="Ex: Ajuste solicitado" />
          </Field>
          <div className="flex gap-2">
            <button onClick={() => setEdit(null)} className="flex-1 rounded-lg border py-2 text-sm">Cancelar</button>
            <button disabled={editEntry.isPending || !editTime} onClick={() => editEntry.mutate()} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {editEntry.isPending ? "Salvando..." : "Salvar correção"}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && filtered.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum registro no período.</p>}
      <ul className="space-y-2">
        {filtered.map((e) => (
          <li key={e.id} className="rounded-xl border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{pName(e.user_id)}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{KIND_LABEL[e.kind]}</span> - <span className="font-mono">{fmtTime(e.recorded_at)}</span>
                  {" - "}{new Date(e.recorded_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  {e.edited_at && <span className="ml-1 text-yellow-500 font-semibold"> (editado)</span>}
                  {e.note?.includes("Offline") && <span className="ml-1 text-blue-500 font-semibold"> (offline)</span>}
                </p>
                {e.note && <p className="text-xs italic text-muted-foreground mt-0.5">{e.note}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  title="Editar horário"
                  onClick={() => { setEdit(e); setEditTime(fmtTime(e.recorded_at)); setEditNote(e.note ?? ""); }}
                  className="rounded-md border p-1.5 text-muted-foreground hover:text-foreground transition"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  title="Excluir registro"
                  onClick={() => { if (confirm("Tem certeza que deseja excluir este horário?")) delEntry.mutate(e); }}
                  className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── GESTÃO DE HORAS ──────────────────────────────────────────────────────────

function GestaoTab() {
  const { data: profiles = [] }  = useAllProfiles();
  const { data: allEntries = [] } = useTeamEntries(60);
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const bizDays = getBusinessDays(year, month);
  const todayKey = dayKey(now);

  const monthEntries = allEntries.filter((e) => {
    const d = new Date(e.recorded_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Horas extras e horas devidas</h2>
        <div className="flex gap-1">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inp + " py-1.5 text-xs"}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{new Date(2000, i).toLocaleDateString("pt-BR", { month: "short" })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={inp + " py-1.5 text-xs w-20"}>
            {[-1, 0, 1].map((d) => <option key={d} value={now.getFullYear() + d}>{now.getFullYear() + d}</option>)}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Dias uteis no mes: <strong>{bizDays}</strong></p>
      <ul className="space-y-2">
        {profiles.map((p) => {
          const pEntries = monthEntries.filter((e) => e.user_id === p.id);
          const days = groupByDay(pEntries, p.daily_minutes);
          const closed = days.filter((d) => d.key !== todayKey || !d.open);
          const worked   = closed.reduce((a, d) => a + d.worked, 0);
          const expected = bizDays * p.daily_minutes;
          const bal = worked - expected;
          return (
            <li key={p.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {bal >= 0 ? "Horas Extras acumuladas" : "Horas Devedoras a compensar"}
                  </p>
                </div>
                <span className={`font-mono text-base font-bold ${bal >= 0 ? "text-success" : "text-destructive"}`}>
                  {bal >= 0 ? `+${fmtMin(bal)}` : fmtMin(bal, true)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                <span>Trabalhado: <b className="text-foreground">{fmtMin(worked)}</b></span>
                <span>Esperado: <b className="text-foreground">{fmtMin(expected)}</b></span>
                <span>Dias registrados: <b className="text-foreground">{closed.length}/{bizDays}</b></span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full transition-all ${bal >= 0 ? "bg-success" : "bg-destructive"}`} style={{ width: `${Math.min(100, expected > 0 ? (worked / expected) * 100 : 0)}%` }} />
              </div>
            </li>
          );
        })}
        {profiles.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhum tecnico cadastrado.</p>}
      </ul>
    </div>
  );
}

// ─── CÁLCULO SALARIAL ─────────────────────────────────────────────────────────

function SalarioTab() {
  const { data: profiles = [] }  = useAllProfiles();
  const { data: allEntries = [] } = useTeamEntries(60);
  const now = new Date();
  const [userId, setUserId]  = useState("");
  const [year, setYear]      = useState(now.getFullYear());
  const [month, setMonth]    = useState(now.getMonth());
  const [salary, setSalary]  = useState(0);
  const [result, setResult]  = useState<ReturnType<typeof calcSalary> | null>(null);

  const profile = profiles.find((p) => p.id === userId);

  const calculate = () => {
    if (!profile) return;
    const monthEntries = allEntries.filter((e) => {
      const d = new Date(e.recorded_at);
      return e.user_id === userId && d.getFullYear() === year && d.getMonth() === month;
    });
    const days    = groupByDay(monthEntries, profile.daily_minutes);
    const closed  = days.filter((d) => d.key !== dayKey(now) || !d.open);
    const worked  = closed.reduce((a, d) => a + d.worked, 0);
    const bizDays = getBusinessDays(year, month);
    const expected = bizDays * profile.daily_minutes;
    setResult(calcSalary({ monthlySalary: salary, dailyMinutes: profile.daily_minutes, workedMinutes: worked, expectedMinutes: expected }));
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Cálculo de salário</h2>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <Field label="Funcionário">
          <select value={userId} onChange={(e) => { setUserId(e.target.value); setResult(null); const p = profiles.find((x) => x.id === e.target.value); if (p?.monthly_salary) setSalary(p.monthly_salary); }} className={inp}>
            <option value="">- Selecionar -</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês">
            <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setResult(null); }} className={inp}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2000, i).toLocaleDateString("pt-BR", { month: "long" })}</option>)}
            </select>
          </Field>
          <Field label="Ano">
            <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setResult(null); }} className={inp}>
              {[-1, 0, 1].map((d) => <option key={d} value={now.getFullYear() + d}>{now.getFullYear() + d}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Salário bruto (R$)">
          <input type="number" min="0" step="0.01" value={salary || ""} onChange={(e) => { setSalary(Number(e.target.value)); setResult(null); }} className={inp} placeholder="0,00" />
        </Field>
        <button disabled={!userId || salary <= 0} onClick={calculate} className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60 transition">
          Calcular Salario Final
        </button>
      </div>

      {result && profile && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="font-semibold text-sm">Demonstrativo: {profile.full_name} - {monthLabel(year, month)}</p>
          <div className="space-y-2 text-sm divide-y">
            <SalRow label="Salário base"    value={fmtBRL(salary)} />
            <SalRow label="Valor hora calculado"      value={fmtBRL(result.hourlyRate)} />
            <SalRow label="Horas extras realizadas"   value={fmtMin(result.extraMinutes)} color="success" />
            <SalRow label="Horas devedoras do mes"    value={fmtMin(result.debtMinutes)}  color="destructive" />
            <SalRow label="Adicional de extras (+50%)" value={`+ ${fmtBRL(result.extraValue)}`}   color="success" />
            <SalRow label="Desconto de horas devedoras" value={`- ${fmtBRL(result.debtValue)}`}    color="destructive" />
          </div>
          <div className="rounded-lg bg-primary/10 p-3.5 flex items-center justify-between border border-primary/20">
            <div>
              <span className="font-semibold block text-foreground">Salário a pagar</span>
              <span className="text-xs text-muted-foreground">Liquido calculado com extras e descontos</span>
            </div>
            <span className="font-mono text-xl font-bold text-primary">{fmtBRL(result.finalSalary)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BACKUP & BANCO DE DADOS LOCAL / E-MAIL ───────────────────────────────────

function BackupTab() {
  const { data: profiles = [] }  = useAllProfiles();
  const { data: allEntries = [] } = useTeamEntries(120);
  const { data: schedules = [] } = useWorkSchedules();
  const [googleEmail, setGoogleEmail] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("vp_admin_email") ?? "" : ""));

  const downloadLocalBackup = () => {
    const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "—";
    const rows = [...allEntries].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
    const W = 1200, rowH = 34, top = 190;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = top + Math.max(1, rows.length) * rowH + 60;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, canvas.height);
    ctx.fillStyle = "#111111"; ctx.font = "bold 36px sans-serif";
    ctx.fillText("Virtual Ponto - Cópia dos registros", 40, 60);
    ctx.font = "20px sans-serif"; ctx.fillStyle = "#444444";
    ctx.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")}  •  ${profiles.length} funcionários  •  ${rows.length} registros`, 40, 100);
    ctx.fillStyle = "#111111"; ctx.font = "bold 20px sans-serif";
    const cols = [40, 420, 600, 720, 900];
    ["Funcionário", "Data", "Hora", "Tipo", "Observação"].forEach((h, i) => ctx.fillText(h, cols[i]!, 160));
    ctx.font = "18px sans-serif";
    rows.forEach((e, i) => {
      const y = top + i * rowH;
      if (i % 2 === 0) { ctx.fillStyle = "#f2f2f2"; ctx.fillRect(30, y - 4, W - 60, rowH); }
      ctx.fillStyle = "#111111";
      const d = new Date(e.recorded_at);
      [nameOf(e.user_id).slice(0, 32), d.toLocaleDateString("pt-BR"), d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), KIND_LABEL[e.kind as keyof typeof KIND_LABEL] ?? e.kind, (e.note ?? "").slice(0, 24)]
        .forEach((t, j) => ctx.fillText(String(t), cols[j]!, y + 20));
    });
    if (rows.length === 0) { ctx.fillStyle = "#444444"; ctx.fillText("Nenhum registro.", 40, top + 20); }
    canvas.toBlob((blob) => {
      if (!blob) { toast.error("Não foi possível gerar a imagem."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_virtualponto_${dayKey(new Date())}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Imagem salva no aparelho.");
    }, "image/jpeg", 0.92);
  };

  const qcImport = useQueryClient();
  const [importing, setImporting] = useState(false);
  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
      const byName = new Map(profiles.map((p) => [norm(p.full_name), p.id]));
      const kindOf = (v: string): EntryKind | null => {
        const k = norm(v).replace(/\s+/g, "_");
        if (k.startsWith("entrada")) return "entrada";
        if (k.includes("volta")) return "volta_almoco";
        if (k.includes("saida_almoco") || k.includes("saida_alm")) return "saida_almoco";
        if (k.startsWith("saida")) return "saida";
        return null;
      };
      const rows: { user_id: string; kind: EntryKind; recorded_at: string; note: string | null }[] = [];
      let skipped = 0;
      if (file.name.toLowerCase().endsWith(".json")) {
        const data = JSON.parse(text);
        const list: any[] = Array.isArray(data) ? data : data.time_entries ?? [];
        const ids = new Set(profiles.map((p) => p.id));
        for (const e of list) {
          const uid = ids.has(e.user_id) ? e.user_id : byName.get(norm(e.funcionario ?? e.full_name ?? ""));
          const kind = kindOf(String(e.kind ?? e.tipo ?? ""));
          if (!uid || !kind || !e.recorded_at) { skipped++; continue; }
          rows.push({ user_id: uid, kind, recorded_at: new Date(e.recorded_at).toISOString(), note: e.note ?? "[Importado]" });
        }
      } else {
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        const sep = lines[0]?.includes(";") ? ";" : ",";
        for (const [i, line] of lines.entries()) {
          const [nome = "", data = "", hora = "", tipo = "", obs = ""] = line.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
          if (i === 0 && norm(nome).startsWith("funcion")) continue;
          const uid = byName.get(norm(nome));
          const kind = kindOf(tipo);
          const m = data.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ?? data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (!uid || !kind || !m) { skipped++; continue; }
          const [y, mo, d] = data.includes("/") ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
          const dt = new Date(`${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}T${(hora || "00:00").padStart(5, "0")}:00`);
          if (isNaN(dt.getTime())) { skipped++; continue; }
          rows.push({ user_id: uid, kind, recorded_at: dt.toISOString(), note: obs || "[Importado]" });
        }
      }
      if (rows.length === 0) { toast.error("Nenhum registro válido encontrado no arquivo."); return; }
      const { error } = await supabase.from("time_entries").insert(rows);
      if (error) throw error;
      qcImport.invalidateQueries({ queryKey: ["team_entries"] });
      qcImport.invalidateQueries({ queryKey: ["entries"] });
      toast.success(`${rows.length} registros importados${skipped ? ` (${skipped} ignorados)` : ""}.`);
    } catch {
      toast.error("Não foi possível importar o arquivo.");
    } finally {
      setImporting(false);
    }
  };

  const sendByEmail = () => {
    if (!googleEmail || !googleEmail.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    const backupData = {
      data: dayKey(new Date()),
      total_funcionarios: profiles.length,
      total_registros: allEntries.length,
    };
    const subject = encodeURIComponent(`Backup Virtual Ponto - ${dayKey(new Date())}`);
    const body = encodeURIComponent(
      `Relatorio de Backup Virtual Ponto:\n\nData: ${new Date().toLocaleString()}\nTotal de Funcionarios: ${profiles.length}\nTotal de Registros de Ponto: ${allEntries.length}\n\nPara restaurar o banco completo, utilize o arquivo baixado no seu computador.`
    );
    window.open(`mailto:${googleEmail}?subject=${subject}&body=${body}`);
    toast.success("Abrimos seu aplicativo de e-mail.");
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Cópia de segurança</h2>
      <p className="text-xs text-muted-foreground">
        Guarde uma cópia completa dos dados no computador ou envie um resumo por e-mail.
      </p>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">Salvar cópia no computador</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Gera uma imagem (JPG) com todos os registros de ponto, fácil de abrir em qualquer celular.
        </p>
        <button
          onClick={downloadLocalBackup}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition"
        >
          <Download className="h-4 w-4" /> Baixar cópia completa
        </button>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">Importar registros de funcionários</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Recupere registros perdidos a partir de uma planilha (CSV) com as colunas: Funcionário, Data, Hora, Tipo, Observação. Também aceita cópias antigas (.json). O funcionário precisa estar cadastrado com o mesmo nome.
        </p>
        <label className={`w-full flex items-center justify-center gap-2 rounded-lg border border-primary py-3 font-semibold text-primary cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`}>
          <Upload className="h-4 w-4" /> {importing ? "Importando..." : "Escolher arquivo"}
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }}
          />
        </label>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">Enviar resumo por e-mail</h3>
        </div>
        <Field label="E-mail de destino">
          <input
            type="email"
            value={googleEmail}
            onChange={(e) => setGoogleEmail(e.target.value)}
            className={inp}
            placeholder="admin@gmail.com"
          />
        </Field>
        <button
          onClick={sendByEmail}
          className="w-full flex items-center justify-center gap-2 rounded-lg border bg-card py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition"
        >
          <Mail className="h-4 w-4" /> Enviar por e-mail
        </button>
      </section>
    </div>
  );
}

// ─── CONFIGURAÇÕES DA CONTA ADMIN ─────────────────────────────────────────────

function ConfigTab() {
  const { data: me } = useMe();
  const [newUsername, setNewUsername] = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirm]     = useState("");
  const [showPass, setShowPass]       = useState(false);
  const [adminEmail, setAdminEmail]   = useState(() => (typeof window !== "undefined" ? localStorage.getItem("vp_admin_email") ?? "" : ""));
  const saveAdminEmail = () => {
    if (adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) { toast.error("Informe um e-mail válido."); return; }
    localStorage.setItem("vp_admin_email", adminEmail.trim());
    toast.success("E-mail do administrador salvo.");
  };

  const updateAccount = useMutation({
    mutationFn: async () => {
      if (newPass && newPass !== confirmPass) {
        throw new Error("As senhas não são iguais.");
      }


      try {
        if (newUsername) {
          const email = newUsername.includes("@") ? newUsername : `${newUsername}@admin.local`;
          await supabase.auth.updateUser({ email });
          if (me?.user?.id) {
            await supabase.from("profiles").update({ email }).eq("id", me.user.id);
          }
        }
        if (newPass) {
          await supabase.auth.updateUser({ password: toAuthPassword(newPass) });
        }
      } catch {}
    },
    onSuccess: () => {
      toast.success("Acesso atualizado.");
      setNewUsername("");
      setNewPass("");
      setConfirm("");
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível atualizar o acesso."),
  });

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Configurações do administrador</h2>
      <div className="rounded-xl border bg-muted/40 p-4 text-sm space-y-1">
        <p className="text-xs text-muted-foreground">Usuário atual</p>
        <p className="font-mono font-medium">{me?.user.email?.replace("@admin.local", "") || "admin"}</p>
      </div>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">E-mail do administrador</h3>
        <p className="text-xs text-muted-foreground">Usado para enviar relatórios e cópias de segurança.</p>
        <Field label="E-mail">
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inp} placeholder="seuemail@empresa.com" />
        </Field>
        <button onClick={saveAdminEmail} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Salvar e-mail</button>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold">Alterar dados de acesso</h3>
        <Field label="Novo usuário">
          <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className={inp} placeholder="Digite o novo usuário" />
        </Field>

        <Field label="Nova senha">
          <div className="relative">
            <input type={showPass ? "text" : "password"} minLength={4} value={newPass} onChange={(e) => setNewPass(e.target.value)} className={inp + " pr-10"} placeholder="Digite a nova senha" />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <Field label="Confirmar Nova senha">
          <input type={showPass ? "text" : "password"} value={confirmPass} onChange={(e) => setConfirm(e.target.value)} className={inp} placeholder="Repita a nova senha" />
        </Field>

        <button
          disabled={(!newUsername && !newPass) || updateAccount.isPending}
          onClick={() => updateAccount.mutate()}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 transition"
        >
          {updateAccount.isPending ? "Salvando..." : "Salvar acesso"}
        </button>
      </section>
    </div>
  );
}

// ─── Helpers compartilhados ───────────────────────────────────────────────────

const inp = "w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: "success" | "warn" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold ${color === "success" ? "text-success" : color === "warn" ? "text-yellow-500" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function SalRow({ label, value, color }: { label: string; value: string; color?: "success" | "destructive" }) {
  return (
    <div className="flex items-center justify-between pt-2 first:pt-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${color === "success" ? "text-success" : color === "destructive" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}
