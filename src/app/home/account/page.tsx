"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; role: string; credits: number } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser({
            email: data.user.email,
            role: data.user.role ?? "user",
            credits: data.user.credits ?? 0,
          });
        }
      });
  }, []);

  async function handleDelete() {
    if (!user || confirmEmail !== user.email) return;
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/delete-account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao excluir conta");
      }

      // Sign out and redirect
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir conta");
      setDeleting(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <p className="text-sm text-[#adaaaa]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-lexend)]">Minha Conta</h1>
        <p className="mt-1 text-sm text-[#adaaaa]">Gerencie suas informações de conta.</p>
      </div>

      {/* Account info */}
      <div className="rounded-2xl bg-[#131313] p-6 space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Email</label>
          <p className="mt-1 text-white">{user.email}</p>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Plano</label>
          <p className="mt-1 text-white capitalize">{user.role}</p>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-[#adaaaa] font-[family-name:var(--font-lexend)]">Créditos</label>
          <p className="mt-1 text-white">{user.credits === -1 ? "Ilimitado" : user.credits}</p>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-red-400 font-[family-name:var(--font-lexend)]">Zona de Perigo</h2>
          <p className="mt-1 text-xs text-[#adaaaa]">
            Ao excluir sua conta, todos os seus dados serão permanentemente removidos. Esta ação não pode ser desfeita.
          </p>
        </div>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors font-[family-name:var(--font-lexend)]"
          >
            Excluir minha conta
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-red-400">
              Para confirmar, digite seu email: <strong>{user.email}</strong>
            </p>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email}
              className="w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-red-500 transition-colors"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={confirmEmail !== user.email || deleting}
                className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors font-[family-name:var(--font-lexend)]"
              >
                {deleting ? "Excluindo..." : "Confirmar exclusão"}
              </button>
              <button
                onClick={() => { setShowConfirm(false); setConfirmEmail(""); setError(null); }}
                className="rounded-full bg-[#20201f] px-5 py-2.5 text-sm text-[#adaaaa] hover:text-white transition-colors font-[family-name:var(--font-lexend)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
