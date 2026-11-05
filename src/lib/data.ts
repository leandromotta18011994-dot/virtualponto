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

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sem sessão");
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        user,
        profile: profile as Profile | null,
        isGestor: (roles ?? []).some((r) => r.role === "gestor"),
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
      const { data, error } = await supabase
        .from("time_entries")
        .select("id,user_id,kind,recorded_at,edited_at,note")
        .eq("user_id", userId!)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });
}

export function useAllProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useWorkSchedules() {
  return useQuery({
    queryKey: ["work_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_schedules")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as WorkSchedule[];
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
      const { data, error } = await supabase
        .from("time_entries")
        .select("id,user_id,kind,recorded_at,edited_at,note")
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });
}
