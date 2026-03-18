import { Resend } from "resend";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { name, email, message, type } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Nome, email e mensagem são obrigatórios." },
        { status: 400 }
      );
    }

    const isCreator = type === "creator";
    const subject = isCreator
      ? `[Creator] ${name} quer fazer parte do hub`
      : `[Contato] Nova mensagem de ${name}`;

    const { data, error: sendError } = await resend.emails.send({
      from: "BubbleIn <noreply@bubblein.com.br>",
      to: ["eva.campos@vecsy.co", "diego.monteiro@gmail.com"],
      subject,
      replyTo: email,
      text: `Nome: ${name}\nEmail: ${email}\nTipo: ${isCreator ? "Creator" : "Empresa"}\n\nMensagem:\n${message}`,
    });

    if (sendError) {
      console.error("[contact] Resend error:", sendError);
      return NextResponse.json(
        { error: "Erro ao enviar mensagem. Tente novamente." },
        { status: 500 }
      );
    }

    console.log("[contact] Email sent successfully, id:", data?.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send email:", error);
    return NextResponse.json(
      { error: "Erro ao enviar mensagem. Tente novamente." },
      { status: 500 }
    );
  }
}
