"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ResourceType,
  ShareRole,
  AccessRole,
  CollaboratorRow,
} from "@/lib/resource-access";

interface ShareDialogProps {
  open: boolean;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  accessRole: AccessRole;
  onClose: () => void;
}

interface OwnerInfo {
  id: string;
  email: string;
  name: string | null;
}

interface ListResponse {
  owner: OwnerInfo | null;
  collaborators: CollaboratorRow[];
}

const RESOURCE_LABEL: Record<ResourceType, string> = {
  casting_list: "Lista de Influencers B2B",
  leads_scan: "Scan de Leads",
  lg_profile: "Perfil de Share of LinkedIn",
};

export function ShareDialog({
  open,
  resourceType,
  resourceId,
  resourceName,
  accessRole,
  onClose,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");
  const [collaborators, setCollaborators] = useState<CollaboratorRow[]>([]);
  const [owner, setOwner] = useState<OwnerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/resource-shares?resourceType=${resourceType}&resourceId=${resourceId}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Falha ao carregar colaboradores");
        return;
      }
      const data = (await res.json()) as ListResponse;
      setCollaborators(data.collaborators ?? []);
      setOwner(data.owner ?? null);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    void fetchList();
  }, [open, fetchList]);

  function flashSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }

  async function handleInvite() {
    if (!email.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/resource-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId,
          email: email.trim(),
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Falha ao convidar");
        return;
      }
      setEmail("");
      const msg =
        data.mode === "updated"
          ? "Permissão atualizada"
          : data.emailSent
            ? "Convite enviado por email"
            : "Acesso concedido";
      flashSuccess(msg);
      await fetchList();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangeRole(shareId: string, newRole: ShareRole) {
    const res = await fetch(`/api/resource-shares/${shareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Falha ao atualizar");
      return;
    }
    flashSuccess("Permissão atualizada");
    await fetchList();
  }

  async function handleRevoke(shareId: string) {
    if (!confirm("Revogar acesso?")) return;
    const res = await fetch(`/api/resource-shares/${shareId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error ?? "Falha ao revogar");
      return;
    }
    flashSuccess("Acesso revogado");
    await fetchList();
  }

  if (!open) return null;

  const showEditorWarning = role === "editor";
  const isEditorActor = accessRole === "editor";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Compartilhar</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              {RESOURCE_LABEL[resourceType]}: <strong>{resourceName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {isEditorActor && (
          <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            Você está convidando como editor — convites criados por você ficam vinculados ao mesmo dono ({owner?.name ?? owner?.email ?? "—"}). Os créditos são debitados da conta dele.
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              disabled={submitting}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ShareRole)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              disabled={submitting}
            >
              <option value="viewer">Visualizador</option>
              <option value="editor">Editor</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={submitting || !email.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "..." : "Convidar"}
            </button>
          </div>

          {showEditorWarning && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
              <strong>Atenção:</strong> editores podem executar ações que consomem créditos da sua conta (novas buscas, reprocessamentos, scans).
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mt-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
            {successMsg}
          </div>
        )}

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            Pessoas com acesso
          </h4>
          {owner && (
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {owner.name ?? owner.email}
                </div>
                <div className="text-xs text-gray-500 truncate">{owner.email}</div>
              </div>
              <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-medium">
                Dono
              </span>
            </div>
          )}
          {loading ? (
            <p className="py-3 text-sm text-gray-500">Carregando...</p>
          ) : collaborators.length === 0 ? (
            <p className="py-3 text-sm text-gray-500">
              Nenhum colaborador ainda. Convide alguém acima.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {collaborators.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {c.userName ?? c.email}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {c.email}
                      {c.status === "pending" && (
                        <span className="ml-2 inline-flex items-center rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium">
                          Convite pendente
                        </span>
                      )}
                    </div>
                  </div>
                  <select
                    value={c.role}
                    onChange={(e) =>
                      handleChangeRole(c.id, e.target.value as ShareRole)
                    }
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                  >
                    <option value="viewer">Visualizador</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button
                    onClick={() => handleRevoke(c.id)}
                    className="text-xs text-red-600 hover:text-red-800 px-1"
                    title="Revogar acesso"
                  >
                    Revogar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
