import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { provisionTrialUser } from "@/lib/auth/provision";
import { isValidBrPhone, stripPhone } from "@/lib/phone";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, companyName, phone, salesContactInterest } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const trimmedCompany = typeof companyName === "string" ? companyName.trim() : "";
  if (!trimmedCompany) {
    return NextResponse.json(
      { error: "Nome da empresa é obrigatório" },
      { status: 400 }
    );
  }

  const phoneDigits = stripPhone(typeof phone === "string" ? phone : "");
  if (!isValidBrPhone(phoneDigits)) {
    return NextResponse.json(
      { error: "Celular inválido. Informe DDD + número (10 ou 11 dígitos)." },
      { status: 400 }
    );
  }

  const interestFlag = typeof salesContactInterest === "boolean" ? salesContactInterest : true;

  const service = createServiceClient();

  const {
    data: { user },
    error,
  } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (user) {
    await provisionTrialUser(user.id, email, {
      companyName: trimmedCompany,
      phone: phoneDigits,
      salesContactInterest: interestFlag,
    });
  }

  return NextResponse.json({
    user: { id: user?.id, email },
  });
}
