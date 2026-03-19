import { createServerClient, createServiceClient } from "@/lib/supabase/server";

export async function checkAdmin(): Promise<{
  isAdmin: boolean;
  userId: string | null;
}> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, userId: null };
  }

  const service = createServiceClient();
  const { data } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return {
    isAdmin: data?.role === "admin",
    userId: user.id,
  };
}
