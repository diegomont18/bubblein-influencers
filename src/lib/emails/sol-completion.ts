import { Resend } from "resend";
import { notifyError } from "@/lib/error-notifier";

interface SendSolCompletionParams {
  toEmail: string;
  companyName: string;
  reportUrl: string;
}

export async function sendSolCompletionEmail(
  params: SendSolCompletionParams
): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[sol-completion] RESEND_API_KEY not set");
    return { ok: false };
  }

  const { toEmail, companyName, reportUrl } = params;

  const subject = `Seu relatório Share of LinkedIn está pronto — ${companyName}`;

  const html = `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <img src="https://getbubblein.com/bubblein-blackbg-logo-influencers-b2b.png" alt="BubbleIn" width="188" style="margin-bottom: 24px;" />
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">Relatório pronto!</h2>
  <p style="color: #555; line-height: 1.6;">O relatório <strong>Share of LinkedIn</strong> de <strong>${companyName}</strong> foi gerado com sucesso.</p>
  <p style="color: #555; line-height: 1.6;">Acesse para ver a análise completa com índice SOL, Share of Voice, engajamento por colaborador, temas e recomendações estratégicas.</p>
  <a href="${reportUrl}" style="display: inline-block; background: linear-gradient(135deg, #a2f31f, #7bc41f); color: #0a1a00; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 700; margin: 16px 0;">Ver relatório</a>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #bbb; font-size: 12px;">Equipe BubbleIn</p>
</div>`;

  const text = `Olá,

O relatório Share of LinkedIn de "${companyName}" foi gerado com sucesso.

Acesse para ver a análise completa: ${reportUrl}

Equipe BubbleIn`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "BubbleIn <noreply@bubblein.com.br>",
      to: [toEmail],
      subject,
      text,
      html,
    });

    if (error) {
      notifyError("sol-completion-email", error, { toEmail, companyName });
      return { ok: false };
    }

    console.log(`[sol-completion] Email sent to ${toEmail} for ${companyName}`);
    return { ok: true };
  } catch (err) {
    notifyError("sol-completion-email", err, { toEmail, companyName });
    return { ok: false };
  }
}
