import { NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { buildCurrentJob } from "@/lib/normalize";

const EDITABLE_FIELDS = new Set([
  "name",
  "headline",
  "company_current",
  "role_current",
  "current_job",
  "followers_count",
  "location",
]);

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate only allowed fields
  const updateFields: Record<string, unknown> = {};
  const editedFieldNames: string[] = [];

  for (const key of Object.keys(body)) {
    if (!EDITABLE_FIELDS.has(key)) {
      return NextResponse.json(
        { error: `Field "${key}" is not editable` },
        { status: 400 }
      );
    }
    updateFields[key] = body[key];
    editedFieldNames.push(key);
  }

  if (editedFieldNames.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const service = createServiceClient();

  // Fetch current profile
  const { data: profile, error: fetchErr } = await service
    .from("profiles")
    .select("edited_fields, role_current, company_current")
    .eq("id", params.id)
    .single();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Merge edited_fields
  const existingEdited: string[] = (profile.edited_fields as string[]) ?? [];
  const mergedEdited = Array.from(new Set([...existingEdited, ...editedFieldNames]));
  updateFields.edited_fields = mergedEdited;

  // If role_current or company_current changed, recompute current_job
  if ("role_current" in updateFields || "company_current" in updateFields) {
    const newRole =
      "role_current" in updateFields
        ? (updateFields.role_current as string | null)
        : profile.role_current;
    const newCompany =
      "company_current" in updateFields
        ? (updateFields.company_current as string | null)
        : profile.company_current;
    updateFields.current_job = buildCurrentJob(newRole, newCompany);
    if (!mergedEdited.includes("current_job")) {
      mergedEdited.push("current_job");
      updateFields.edited_fields = mergedEdited;
    }
  }

  const { data: updated, error: updateErr } = await service
    .from("profiles")
    .update(updateFields)
    .eq("id", params.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ profile: updated });
}
