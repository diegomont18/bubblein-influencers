import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import crypto from "crypto";

// POST: request password reset (sends email)
export async function POST(request: Request) {
  const body = await request.json();
  const { email, origin } = body;

  if (!email) {
    return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
  }

  const service = createServiceClient();

  // Find user by email
  const { data: { users }, error: listError } = await service.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    // Don't reveal if email exists — always show success
    return NextResponse.json({ success: true });
  }

  // Generate secure token
  const token = crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store token
  const { error: insertError } = await service
    .from("password_reset_tokens")
    .insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    console.error("[reset-password] Failed to store token:", insertError);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  // Send email via Resend
  const resetUrl = `${origin || "https://bubblein.com.br"}/reset-password?token=${token}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: sendError } = await resend.emails.send({
      from: "BubbleIn <noreply@bubblein.com.br>",
      to: [email],
      subject: "Redefinir sua senha - BubbleIn",
      text: `Olá,

Recebemos uma solicitação para redefinir sua senha no BubbleIn.

Clique no link abaixo para criar uma nova senha:
${resetUrl}

Este link expira em 1 hora.

Se você não solicitou a redefinição, ignore este email.

Atenciosamente,
Equipe BubbleIn`,
      html: `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <img src="https://bubblein.com.br/logo.png" alt="BubbleIn" width="140" style="margin-bottom: 24px;" />
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Redefinir sua senha</h2>
  <p style="color: #555; line-height: 1.6;">Recebemos uma solicitação para redefinir sua senha no BubbleIn.</p>
  <p style="color: #555; line-height: 1.6;">Clique no botão abaixo para criar uma nova senha:</p>
  <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ca98ff, #9c42f4); color: #46007d; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; margin: 16px 0;">Redefinir senha</a>
  <p style="color: #999; font-size: 13px; margin-top: 24px;">Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #bbb; font-size: 12px;">Equipe BubbleIn</p>
</div>`,
    });

    if (sendError) {
      console.error("[reset-password] Resend error:", sendError);
      return NextResponse.json({ error: "Erro ao enviar email" }, { status: 500 });
    }
  } catch (err) {
    console.error("[reset-password] Email send failed:", err);
    return NextResponse.json({ error: "Erro ao enviar email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH: set new password using token
export async function PATCH(request: Request) {
  const body = await request.json();
  const { token, password } = body;

  if (!token || !password) {
    return NextResponse.json({ error: "Token e senha são obrigatórios" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
  }

  const service = createServiceClient();

  // Look up token
  const { data: tokenRecord, error: tokenError } = await service
    .from("password_reset_tokens")
    .select("*")
    .eq("token", token)
    .eq("used", false)
    .single();

  if (tokenError || !tokenRecord) {
    return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 400 });
  }

  // Check expiry
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return NextResponse.json({ error: "Token expirado. Solicite um novo link." }, { status: 400 });
  }

  // Update password
  const { error: updateError } = await service.auth.admin.updateUserById(
    tokenRecord.user_id,
    { password }
  );

  if (updateError) {
    console.error("[reset-password] Update failed:", updateError);
    return NextResponse.json({ error: "Erro ao atualizar senha" }, { status: 500 });
  }

  // Mark token as used
  await service
    .from("password_reset_tokens")
    .update({ used: true })
    .eq("id", tokenRecord.id);

  return NextResponse.json({ success: true });
}
