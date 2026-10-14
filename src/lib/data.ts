import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Entry } from "./time";

export type Profile = { id: string; full_name: string; email: string | null; daily_minutes: number; lunch_minutes: number };

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
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
        .select("id,user_id,kind,recorded_at")
        .eq("user_id", userId!)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });
}
