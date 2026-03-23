"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputClass =
    "w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors";
  const labelClass =
    "block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao redefinir senha.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] font-[family-name:var(--font-be-vietnam-pro)]">
        <div className="w-full max-w-md px-6">
          <div className="rounded-2xl bg-[#1a1a1a] p-8 text-center space-y-4">
            <p className="text-sm text-[#ff946e]">Link inválido. Solicite um novo link de recuperação.</p>
            <Link href="/login" className="text-sm text-[#ca98ff] hover:text-[#9c42f4] font-medium transition-colors">
              Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] font-[family-name:var(--font-be-vietnam-pro)]">
      <div className="w-full max-w-md px-6">
        <div className="rounded-2xl bg-[#1a1a1a] p-8 space-y-6">
          <div className="text-center">
            <img src="/logo.png" alt="BubbleIn" width={160} height={57} className="mx-auto" />
            <p className="mt-4 text-sm text-[#adaaaa] font-[family-name:var(--font-lexend)]">
              Redefinir senha
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <p className="text-sm text-[#a2f31f] bg-[#a2f31f]/10 rounded-xl px-4 py-3">
                Senha alterada com sucesso!
              </p>
              <Link
                href="/login"
                className="block w-full text-center rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3 text-sm font-semibold text-[#46007d] hover:scale-[1.02] active:scale-95 transition-all font-[family-name:var(--font-lexend)]"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className={labelClass}>Nova Senha</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="confirm" className={labelClass}>Confirmar Senha</label>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita sua senha"
                  className={inputClass}
                />
              </div>

              {error && <p className="text-sm text-[#ff946e]">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3 text-sm font-semibold text-[#46007d] hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
