"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatBrPhone, isValidBrPhone, stripPhone } from "@/lib/phone";
import Link from "next/link";

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [salesContactInterest, setSalesContactInterest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") || "/casting";
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const trimmedCompany = companyName.trim();
    if (!trimmedCompany) {
      setError("Informe o nome da empresa.");
      return;
    }

    const phoneDigits = stripPhone(phone);
    if (!isValidBrPhone(phoneDigits)) {
      setError("Celular inválido. Informe DDD + número (10 ou 11 dígitos).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          companyName: trimmedCompany,
          phone: phoneDigits,
          salesContactInterest,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create account.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] font-[family-name:var(--font-be-vietnam-pro)]">
      <div className="w-full max-w-md px-6 py-10">
        <div className="rounded-2xl bg-[#1a1a1a] p-8 space-y-6">
          <div className="text-center">
            <img
              src="/bubblein-blackbg-logo-influencers-b2b.png"
              alt="BubbleIn"
              width={214}
              height={57}
              className="mx-auto"
            />
            <p className="mt-4 text-sm text-[#adaaaa] font-[family-name:var(--font-lexend)]">
              Crie sua conta
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="company-name"
                className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]"
              >
                Nome da empresa
              </label>
              <input
                id="company-name"
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoComplete="organization"
                placeholder="Sua empresa"
                className="w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]"
              >
                Celular
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(formatBrPhone(e.target.value))}
                autoComplete="tel"
                placeholder="(11) 91234-5678"
                inputMode="numeric"
                className="w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]"
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Mín. 6 caracteres"
                className="w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2 font-[family-name:var(--font-lexend)]"
              >
                Confirmar Senha
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Repita sua senha"
                className="w-full rounded-xl bg-[#20201f] px-4 py-3 text-sm text-white placeholder-white/30 outline-none border-b-2 border-transparent focus:border-[#ca98ff] transition-colors"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={salesContactInterest}
                onChange={(e) => setSalesContactInterest(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#20201f] accent-[#ca98ff]"
              />
              <span className="text-sm text-[#adaaaa] font-[family-name:var(--font-lexend)]">
                Tem interesse que nossa equipe comercial entre em contato?
              </span>
            </label>

            {error && (
              <p className="text-sm text-[#ff946e]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] px-6 py-3 text-sm font-semibold text-[#46007d] hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all font-[family-name:var(--font-lexend)]"
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </button>
          </form>

          <p className="text-center text-sm text-[#adaaaa]">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="text-[#ca98ff] hover:text-[#9c42f4] font-medium transition-colors"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0e0e0e]" />}>
      <SignUpForm />
    </Suspense>
  );
}
