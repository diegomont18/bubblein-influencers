import { createServiceClient } from "@/lib/supabase/server";

const TRIAL_BASE_CREDITS = 5;

export interface ProvisionOpts {
  companyName?: string | null;
  phone?: string | null;
  salesContactInterest?: boolean | null;
}

export async function provisionTrialUser(
  userId: string,
  email: string,
  opts: ProvisionOpts = {}
): Promise<number> {
  const service = createServiceClient();
  const normalizedEmail = email.toLowerCase().trim();

  const { data: pending } = await service
    .from("pending_credits")
    .select("id, extra_credits")
    .eq("email", normalizedEmail)
    .eq("claimed", false);

  const totalExtra = (pending ?? []).reduce(
    (sum: number, p: { extra_credits: number }) => sum + p.extra_credits,
    0
  );
  const initialCredits = TRIAL_BASE_CREDITS + totalExtra;

  await service.from("user_roles").insert({
    user_id: userId,
    role: "user",
    credits: initialCredits,
    credits_total: initialCredits,
    company_name: opts.companyName ?? null,
    phone: opts.phone ?? null,
    sales_contact_interest:
      typeof opts.salesContactInterest === "boolean" ? opts.salesContactInterest : true,
  });

  if (pending && pending.length > 0) {
    await service
      .from("pending_credits")
      .update({ claimed: true, claimed_at: new Date().toISOString() })
      .in("id", pending.map((p: { id: string }) => p.id));
  }

  return initialCredits;
}
