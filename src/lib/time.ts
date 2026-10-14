export type EntryKind = "entrada" | "saida_almoco" | "volta_almoco" | "saida";
export type Entry = { id: string; user_id: string; kind: EntryKind; recorded_at: string };

export const KIND_LABEL: Record<EntryKind, string> = {
  entrada: "Entrada",
  saida_almoco: "Saída almoço",
  volta_almoco: "Volta almoço",
  saida: "Saída",
};

const IN: EntryKind[] = ["entrada", "volta_almoco"];

export function dayKey(d: Date | string) {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function fmtMin(min: number, signed = false) {
  const sign = min < 0 ? "-" : signed && min > 0 ? "+" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export type DaySummary = {
  key: string;
  entries: Entry[];
  worked: number;
  lunch: number;
  balance: number;
  open: boolean;
};

export function summarizeDay(entries: Entry[], dailyMinutes: number, now = new Date()): Omit<DaySummary, "key"> {
  const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  let worked = 0, lunch = 0;
  let inAt: number | null = null;
  let lunchAt: number | null = null;
  for (const e of sorted) {
    const t = new Date(e.recorded_at).getTime();
    if (IN.includes(e.kind)) {
      if (e.kind === "volta_almoco" && lunchAt !== null) { lunch += (t - lunchAt) / 60000; lunchAt = null; }
      inAt = t;
    } else {
      if (inAt !== null) { worked += (t - inAt) / 60000; inAt = null; }
      if (e.kind === "saida_almoco") lunchAt = t;
    }
  }
  const isToday = sorted.length > 0 && dayKey(sorted[0].recorded_at) === dayKey(now);
  const open = inAt !== null;
  if (open && isToday) worked += (now.getTime() - inAt!) / 60000;
  if (lunchAt !== null && isToday) lunch += (now.getTime() - lunchAt) / 60000;
  return { entries: sorted, worked, lunch, balance: worked - dailyMinutes, open };
}

export function groupByDay(entries: Entry[], dailyMinutes: number): DaySummary[] {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = dayKey(e.recorded_at);
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, es]) => ({ key, ...summarizeDay(es, dailyMinutes) }));
}

export function nextKinds(today: Entry[]): EntryKind[] {
  const last = [...today].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).at(-1)?.kind;
  switch (last) {
    case "entrada": return ["saida_almoco", "saida"];
    case "saida_almoco": return ["volta_almoco"];
    case "volta_almoco": return ["saida"];
    default: return ["entrada"];
  }
}

export function fmtDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
