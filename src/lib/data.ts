import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Entry } from "./time";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  daily_minutes: number;
  lunch_minutes: number;
  monthly_salary: number;
  work_schedule_id: string | null;
  is_active: boolean;
};

export type WorkSchedule = {
  id: string;
  name: string;
  entry_time: string;
  lunch_start: string;
  lunch_end: string;
  exit_time: string;
  daily_minutes: number;
  lunch_minutes: number;
  created_at: string;
};

// ─── Sincronização Automática Offline ─────────────────────────────────────────

const OFFLINE_QUEUE_KEY = "vp_offline_queue";

export function getOfflineQueue(): Entry[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addOfflineEntry(entry: Entry) {
  if (typeof window === "undefined") return;
  const queue = getOfflineQueue();
  queue.push(entry);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

  // Também adiciona na lista local para exibição imediata
  const key = `vp_entries_${entry.user_id}`;
  const userEntries = localStorage.getItem(key);
  const list: Entry[] = userEntries ? JSON.parse(userEntries) : [];
  list.unshift(entry);
  localStorage.setItem(key, JSON.stringify(list));

  const allKey = "vp_all_time_entries";
  const allEntriesRaw = localStorage.getItem(allKey);
  const allList: Entry[] = allEntriesRaw ? JSON.parse(allEntriesRaw) : [];
  allList.unshift(entry);
  localStorage.setItem(allKey, JSON.stringify(allList));
}

export async function syncOfflineQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const remaining: Entry[] = [];

  for (const item of queue) {
    try {
      const { error } = await supabase.from("time_entries").insert({
        user_id: item.user_id,
        kind: item.kind,
        recorded_at: item.recorded_at,
        note: item.note || "[Sincronizado apos conexao]",
      });
      if (error) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  if (queue.length > remaining.length) {
    console.log(`[Offline Sync] ${queue.length - remaining.length} registros sincronizados com sucesso.`);
  }
}

// Ouvinte de restabelecimento de conexao
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    syncOfflineQueue();
  });
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      // Tenta sincronizar registros pendentes
      syncOfflineQueue();

      if (typeof window !== "undefined") {
        const isLocalAdmin = localStorage.getItem("vp_is_admin_session") === "true";
        if (isLocalAdmin) {
          const storedCredsRaw = localStorage.getItem("vp_admin_credentials");
          const adminCreds = storedCredsRaw ? JSON.parse(storedCredsRaw) : { username: "admin", email: "admin@admin.local" };
          return {
            user: {
              id: "admin-root-id",
              email: adminCreds.email || "admin@admin.local",
            } as any,
            profile: {
              id: "admin-root-id",
              full_name: "Administrador",
              email: adminCreds.email || "admin@admin.local",
              daily_minutes: 480,
              lunch_minutes: 60,
              monthly_salary: 0,
              work_schedule_id: null,
              is_active: true,
            } as Profile,
            isGestor: true,
          };
        }

        const currentLocalUser = localStorage.getItem("vp_current_user");
        if (currentLocalUser) {
          try {
            const u = JSON.parse(currentLocalUser);
            if (u.id) {
              return {
                user: { id: u.id, email: u.email } as any,
                profile: u as Profile,
                isGestor: u.role === "gestor",
              };
            }
          } catch {}
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sem sessao ativa");
      }

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const isGestor =
        user.email === "admin@admin.local" ||
        (roles ?? []).some((r) => r.role === "gestor");

      return {
        user,
        profile: (profile ?? {
          id: user.id,
          full_name: user.user_metadata?.full_name || "Usuario",
          email: user.email || null,
          daily_minutes: 480,
          lunch_minutes: 60,
          monthly_salary: 0,
          work_schedule_id: null,
          is_active: true,
        }) as Profile,
        isGestor,
      };
    },
  });
}

export function useEntries(userId: string | undefined, sinceDays = 31) {
  return useQuery({
    queryKey: ["entries", userId, sinceDays],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - sinceDays);
      since.setHours(0, 0, 0, 0);

      try {
        const { data, error } = await supabase
          .from("time_entries")
          .select("id,user_id,kind,recorded_at,edited_at,note")
          .eq("user_id", userId!)
          .gte("recorded_at", since.toISOString())
          .order("recorded_at", { ascending: false });

        if (!error && data) {
          return data as Entry[];
        }
      } catch {}

      if (typeof window !== "undefined") {
        const local = localStorage.getItem(`vp_entries_${userId}`);
        if (local) {
          try {
            return JSON.parse(local) as Entry[];
          } catch {}
        }
      }

      return [] as Entry[];
    },
  });
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("full_name");
        if (!error && data && data.length > 0) {
          return data as Profile[];
        }
      } catch {}

      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("vp_team_profiles");
        if (stored) {
          try {
            return JSON.parse(stored) as Profile[];
          } catch {}
        }
      }

      return [] as Profile[];
    },
  });
}

export function useWorkSchedules() {
  return useQuery({
    queryKey: ["work_schedules"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("work_schedules")
          .select("*")
          .order("name");
        if (!error && data && data.length > 0) {
          return data as WorkSchedule[];
        }
      } catch {}

      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("vp_work_schedules");
        if (stored) {
          try {
            return JSON.parse(stored) as WorkSchedule[];
          } catch {}
        }
      }

      return [
        {
          id: "default-schedule",
          name: "Padrao (08:00 as 17:00)",
          entry_time: "08:00",
          lunch_start: "12:00",
          lunch_end: "13:00",
          exit_time: "17:00",
          daily_minutes: 480,
          lunch_minutes: 60,
          created_at: new Date().toISOString(),
        },
      ] as WorkSchedule[];
    },
  });
}

export function useTeamEntries(sinceDays = 60) {
  return useQuery({
    queryKey: ["team_entries", sinceDays],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - sinceDays);
      since.setHours(0, 0, 0, 0);

      try {
        const { data, error } = await supabase
          .from("time_entries")
          .select("id,user_id,kind,recorded_at,edited_at,note")
          .gte("recorded_at", since.toISOString())
          .order("recorded_at", { ascending: false });

        if (!error && data) return data as Entry[];
      } catch {}

      if (typeof window !== "undefined") {
        const teamRaw = localStorage.getItem("vp_all_time_entries");
        if (teamRaw) {
          try {
            return JSON.parse(teamRaw) as Entry[];
          } catch {}
        }
      }

      return [] as Entry[];
    },
  });
}
