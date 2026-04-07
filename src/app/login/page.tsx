"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const unauthorized = searchParams.get("error") === "unauthorized";
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("Algo deu errado. Tente novamente.");
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Informe seu email.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, origin: window.location.origin }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao enviar email.");
        return;
      }

      setResetSent(true);
    } catch {
      setError("Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors";
  const labelClass =
    "block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] font-[family-name:var(--font-be-vietnam-pro)]">
      <div className="w-full max-w-md px-6">
        <div className="rounded-2xl bg-[#1a1a1a] p-8 space-y-6">
          <div className="text-center">
            <img
              src="/logo.png"
              alt="BubbleIn"
              width={160}
              height={57}
              className="mx-auto"
            />
            <p className="mt-4 text-sm text-[#adaaaa] font-[family-name:var(--font-lexend)]">
              {resetMode ? "Recuperar senha" : "Entre na sua conta"}
            </p>
          </div>

          {unauthorized && !resetMode && (
            <p className="text-sm text-[#ff946e] bg-[#ff946e]/10 rounded-xl px-4 py-3">
              Acesso negado. Você não tem permissões de administrador para
              acessar o painel.
            </p>
          )}

          {resetMode ? (
            resetSent ? (
              <div className="space-y-4">
                <p className="text-sm text-[#a2f31f] bg-[#a2f31f]/10 rounded-xl px-4 py-3">
                  Link de recuperação enviado para <strong>{email}</strong>.
                  Verifique sua caixa de entrada.
                </p>
                <button
                  onClick={() => {
                    setResetMode(false);
                    setResetSent(false);
                    setError(null);
                  }}
                  className="w-full text-center text-sm text-[#ca98ff] hover:text-[#9c42f4] font-medium transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <p className="text-xs text-[#adaaaa]">
                  Informe seu email e enviaremos um link para redefinir sua
                  senha.
                </p>
                <div>
                  <label htmlFor="reset-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className={inputClass}
                  />
                </div>

                {error && <p className="text-sm text-[#ff946e]">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3 text-sm font-semibold text-[#46007d] hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
                >
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false);
                    setError(null);
                  }}
                  className="w-full text-center text-sm text-[#ca98ff] hover:text-[#9c42f4] font-medium transition-colors"
                >
                  Voltar ao login
                </button>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    className={inputClass}
                  />
                </div>

                {error && <p className="text-sm text-[#ff946e]">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3 text-sm font-semibold text-[#46007d] hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <div className="text-center space-y-2">
                <p className="text-sm text-[#adaaaa]">
                  Não tem conta?{" "}
                  <Link
                    href="/signup"
                    className="text-[#ca98ff] hover:text-[#9c42f4] font-medium transition-colors"
                  >
                    Cadastre-se
                  </Link>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true);
                    setError(null);
                  }}
                  className="text-xs text-[#adaaaa] hover:text-[#ca98ff] transition-colors"
                >
                  Perdi minha senha
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
