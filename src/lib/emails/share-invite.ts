import { Resend } from "resend";
import { notifyError } from "@/lib/error-notifier";
import type { ResourceType, ShareRole } from "@/lib/resource-access";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  casting_list: "lista de Influencers B2B",
  leads_scan: "scan de Leads",
  lg_profile: "perfil de Share of LinkedIn",
};

const ROLE_LABEL: Record<ShareRole, string> = {
  viewer: "Visualizador",
  editor: "Editor",
};

interface SendShareInviteParams {
  toEmail: string;
  isExistingUser: boolean;
  ownerName: string;
  ownerEmail: string;
  resourceName: string;
  resourceType: ResourceType;
  role: ShareRole;
  acceptUrl: string;
}

export async function sendShareInviteEmail(
  params: SendShareInviteParams
): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[share-invite] RESEND_API_KEY not set");
    return { ok: false };
  }

  const {
    toEmail,
    isExistingUser,
    ownerName,
    resourceName,
    resourceType,
    role,
    acceptUrl,
  } = params;

  const ownerLabel = ownerName || params.ownerEmail;
  const resourceLabel = RESOURCE_LABEL[resourceType];
  const roleLabel = ROLE_LABEL[role];

  const subject = isExistingUser
    ? `${ownerLabel} compartilhou um relatório com você no BubbleIn`
    : `${ownerLabel} te convidou para o BubbleIn`;

  const editorWarning =
    role === "editor"
      ? `<p style="color: #b45309; background: #fef3c7; padding: 12px 16px; border-radius: 8px; line-height: 1.5; font-size: 14px;">
        <strong>Atenção:</strong> como Editor, suas ações dentro deste recurso (novas buscas, reprocessamentos, scans) consomem créditos da conta de ${ownerLabel}.
      </p>`
      : "";

  const introHtml = isExistingUser
    ? `<p style="color: #555; line-height: 1.6;">${ownerLabel} compartilhou <strong>${resourceName}</strong> (${resourceLabel}) com você como <strong>${roleLabel}</strong>.</p>
       <p style="color: #555; line-height: 1.6;">Acesse direto na sua conta:</p>`
    : `<p style="color: #555; line-height: 1.6;">${ownerLabel} te convidou para colaborar em <strong>${resourceName}</strong> (${resourceLabel}) como <strong>${roleLabel}</strong>.</p>
       <p style="color: #555; line-height: 1.6;">Crie uma senha para começar — você ganha 5 créditos de trial para fazer suas próprias buscas no BubbleIn.</p>`;

  const buttonLabel = isExistingUser ? "Abrir relatório" : "Aceitar convite";

  const introText = isExistingUser
    ? `${ownerLabel} compartilhou "${resourceName}" (${resourceLabel}) com você como ${roleLabel}.

Acesse direto na sua conta: ${acceptUrl}`
    : `${ownerLabel} te convidou para colaborar em "${resourceName}" (${resourceLabel}) como ${roleLabel}.

Crie uma senha para começar — você ganha 5 créditos de trial.

Aceite o convite: ${acceptUrl}`;

  const editorWarningText =
    role === "editor"
      ? `

ATENÇÃO: Como Editor, suas ações neste recurso consomem créditos da conta de ${ownerLabel}.`
      : "";

  const html = `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <img src="https://getbubblein.com/bubblein-blackbg-logo-influencers-b2b.png" alt="BubbleIn" width="188" style="margin-bottom: 24px;" />
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">${isExistingUser ? "Você recebeu um relatório" : "Você foi convidado"}</h2>
  ${introHtml}
  ${editorWarning}
  <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #ca98ff, #9c42f4); color: #46007d; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; margin: 16px 0;">${buttonLabel}</a>
  <p style="color: #999; font-size: 13px; margin-top: 24px;">Se você não esperava esse convite, pode ignorar este email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #bbb; font-size: 12px;">Equipe BubbleIn</p>
</div>`;

  const text = `Olá,

${introText}${editorWarningText}

Se você não esperava esse convite, pode ignorar este email.

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
      notifyError("share-invite-email", error, { toEmail, resourceType });
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    notifyError("share-invite-email", err, { toEmail, resourceType });
    return { ok: false };
  }
}
