import { Resend } from "resend";

const ADMIN_EMAIL = "diego@aihubstudio.com";

export function notifyError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): void {
  // Fire-and-forget: don't block the calling code
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[error-notifier] RESEND_API_KEY not set. Error in ${context}:`, error);
    return;
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack ?? "" : "";

  const metadataStr = metadata ? JSON.stringify(metadata, null, 2) : "N/A";

  const subject = `[BubbleIn Error] ${dateStr} ${timeStr} — ${context}`;
  const body = `Erro na plataforma BubbleIn

Contexto: ${context}
Data: ${dateStr}
Hora: ${timeStr}

Erro: ${errorMessage}

Stack Trace:
${errorStack}

Metadata:
${metadataStr}

---
Enviado automaticamente pelo sistema de monitoramento BubbleIn.`;

  const resend = new Resend(apiKey);
  resend.emails.send({
    from: "BubbleIn Alerts <noreply@bubblein.com.br>",
    to: [ADMIN_EMAIL],
    subject,
    text: body,
  }).then(({ error: sendError }) => {
    if (sendError) console.error("[error-notifier] Failed to send:", sendError.message);
    else console.log(`[error-notifier] Error notification sent for: ${context}`);
  }).catch((err) => {
    console.error("[error-notifier] Exception:", err);
  });
}
