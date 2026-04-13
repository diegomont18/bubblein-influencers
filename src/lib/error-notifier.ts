import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

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

  // Resolve user email if userId is in metadata
  const userId = metadata?.userId as string | undefined;

  const sendEmail = (userEmail: string) => {
    const metadataStr = metadata ? JSON.stringify(metadata, null, 2) : "N/A";

    const subject = `[BubbleIn] ${dateStr} ${timeStr} — ${context}`;
    const body = `Notificação BubbleIn

Usuário: ${userEmail}
Contexto: ${context}
Data: ${dateStr}
Hora: ${timeStr}

Mensagem: ${errorMessage}

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
      else console.log(`[error-notifier] Notification sent for: ${context}`);
    }).catch((err) => {
      console.error("[error-notifier] Exception:", err);
    });
  };

  if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    supabase.auth.admin.getUserById(userId).then(({ data }) => {
      sendEmail(data?.user?.email ?? `ID: ${userId}`);
    }).catch(() => {
      sendEmail(`ID: ${userId}`);
    });
  } else {
    sendEmail(userId ? `ID: ${userId}` : "Sistema (sem usuário)");
  }
}
