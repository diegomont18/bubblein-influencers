"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const ROLE_LABEL: Record<string, string> = {
  viewer: "Visualizador",
  editor: "Editor",
};

const RESOURCE_LABEL: Record<string, string> = {
  casting_list: "Lista de Influencers B2B",
  leads_scan: "Scan de Leads",
  lg_profile: "Perfil de Share of LinkedIn",
};

interface InviteInfo {
  email: string;
  role: "viewer" | "editor";
  resourceType: string;
  resourceId: string;
  resourceName: string;
  ownerName: string;
  ownerEmail: string;
  hasAccount: boolean;
}

type Stage =
  | { kind: "loading" }
  | { kind: "expired"; message?: string }
  | { kind: "form"; info: InviteInfo; mode: "create" | "login" | "confirm" | "wrongAccount"; currentEmail?: string };

interface Props {
  token: string;
}

export function AcceptInviteClient({ token }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStage({ kind: "loading" });
    try {
      const res = await fetch(`/api/invites/${token}`);
      if (res.status === 410) {
        const data = await res.json().catch(() => ({}));
        setStage({
          kind: "expired",
          message:
            data.code === "expired"
              ? "Este convite expirou. Peça ao remetente para reenviar."
              : "Este convite não é mais válido.",
        });
        return;
      }
      if (!res.ok) {
        setStage({ kind: "expired", message: "Não foi possível carregar o convite." });
        return;
      }
      const info = (await res.json()) as InviteInfo;

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const {
        data: { user: loggedInUser },
      } = await supabase.auth.getUser();

      if (loggedInUser) {
        const currentEmail = (loggedInUser.email ?? "").toLowerCase();
        if (currentEmail === info.email.toLowerCase()) {
          setStage({ kind: "form", info, mode: "confirm", currentEmail });
        } else {
          setStage({ kind: "form", info, mode: "wrongAccount", currentEmail });
        }
        return;
      }

      setStage({
        kind: "form",
        info,
        mode: info.hasAccount ? "login" : "create",
      });
    } catch (err) {
      console.error("[accept-invite] load error", err);
      setStage({ kind: "expired", message: "Erro ao carregar convite." });
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreatePassword() {
    if (stage.kind !== "form" || stage.mode !== "create") return;
    setErrorMsg(null);
    if (password.length < 6) {
      setErrorMsg("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("As senhas não conferem");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Falha ao aceitar convite");
        return;
      }
      router.push(data.redirectUrl);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin() {
    if (stage.kind !== "form" || stage.mode !== "login") return;
    setErrorMsg(null);
    if (!password) {
      setErrorMsg("Informe sua senha");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await supabase.auth.signInWithPassword({
        email: stage.info.email,
        password,
      });
      if (error) {
        setErrorMsg(error.message ?? "Email ou senha incorretos");
        return;
      }
      const acceptRes = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const acceptData = await acceptRes.json();
      if (!acceptRes.ok) {
        setErrorMsg(acceptData.error ?? "Falha ao aceitar convite");
        return;
      }
      router.push(acceptData.redirectUrl);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (stage.kind !== "form" || stage.mode !== "confirm") return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Falha ao aceitar convite");
        return;
      }
      router.push(data.redirectUrl);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSwitchAccount() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    void load();
  }

  if (stage.kind === "loading") {
    return (
      <Shell>
        <p className="text-sm text-gray-600">Carregando convite...</p>
      </Shell>
    );
  }

  if (stage.kind === "expired") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-gray-900">Convite indisponível</h1>
        <p className="mt-3 text-sm text-gray-600">{stage.message}</p>
      </Shell>
    );
  }

  const { info, mode } = stage;
  const resourceLabel = RESOURCE_LABEL[info.resourceType] ?? info.resourceType;
  const roleLabel = ROLE_LABEL[info.role] ?? info.role;

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-gray-900">
        {mode === "create" ? "Aceitar convite e criar conta" : "Aceitar convite"}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        <strong>{info.ownerName}</strong> compartilhou{" "}
        <strong>{info.resourceName}</strong> ({resourceLabel}) com você como{" "}
        <strong>{roleLabel}</strong>.
      </p>

      {info.role === "editor" && (
        <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <strong>Atenção:</strong> como Editor, suas ações neste recurso (novas buscas, reprocessamentos) consomem créditos da conta de {info.ownerName}.
        </div>
      )}

      {mode === "create" && (
        <div className="mt-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={info.email}
              readOnly
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Crie uma senha (mínimo 6 caracteres)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Confirme a senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
          <p className="text-xs text-gray-500">
            Você ganha 5 créditos de trial para fazer suas próprias buscas no BubbleIn.
          </p>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <button
            onClick={handleCreatePassword}
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Criando conta..." : "Criar conta e abrir relatório"}
          </button>
        </div>
      )}

      {mode === "login" && (
        <div className="mt-5 space-y-3">
          <p className="text-xs text-gray-600">
            Você já tem uma conta no BubbleIn com este email. Faça login para aceitar o convite.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={info.email}
              readOnly
              className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              autoFocus
            />
          </div>
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <button
            onClick={handleLogin}
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Entrando..." : "Entrar e aceitar"}
          </button>
        </div>
      )}

      {mode === "confirm" && (
        <div className="mt-5 space-y-3">
          {errorMsg && <ErrorBox msg={errorMsg} />}
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Aceitando..." : "Aceitar e abrir relatório"}
          </button>
        </div>
      )}

      {mode === "wrongAccount" && (
        <div className="mt-5 space-y-3">
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
            Você está logado como <strong>{stage.currentEmail}</strong>, mas o convite é para <strong>{info.email}</strong>.
          </div>
          <button
            onClick={handleSwitchAccount}
            className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Sair e aceitar com {info.email}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg p-8">
        <div className="mb-6">
          <img
            src="https://getbubblein.com/bubblein-blackbg-logo-influencers-b2b.png"
            alt="BubbleIn"
            className="h-10"
          />
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
      {msg}
    </div>
  );
}
