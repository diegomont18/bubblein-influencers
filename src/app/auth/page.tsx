"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") || "/casting/leads-generation";
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("As senhas não coincidem");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("A senha deve ter pelo menos 6 caracteres");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Erro ao criar conta");
          setLoading(false);
          return;
        }

        // Auto sign in after signup
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
      }

      router.push(redirectUrl);
      router.refresh();
    } catch {
      setError("Algo deu errado. Tente novamente.");
      setLoading(false);
    }
  }

  const inputClass = "w-full bg-[#20201f] rounded-xl px-4 py-3.5 text-sm text-white placeholder-white/30 outline-none border border-transparent focus:border-[#ca98ff] transition-colors";

  return (
    <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl">
        {/* Left: Auth form */}
        <div className="bg-[#1a1a1a] p-10 md:p-12 flex flex-col">
          <div className="mb-8">
            <Image src="/logo.png" alt="BubbleIn" width={120} height={43} />
            <p className="text-[#adaaaa] text-sm mt-3">
              {mode === "login" ? "Acesse sua análise de LinkedIn" : "Crie sua conta gratuita"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                className={inputClass}
              />
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#adaaaa] mb-2">Confirmar Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Repita a senha"
                  className={inputClass}
                />
              </div>
            )}

            {error && <p className="text-sm text-[#ff6e84]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#ca98ff] to-[#9c42f4] text-[#1a0033] font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
            >
              {loading ? (mode === "login" ? "Entrando..." : "Criando conta...") : (mode === "login" ? "Entrar" : "Criar conta")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-[#adaaaa]">
              {mode === "login" ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
              <button
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
                className="text-[#ca98ff] font-semibold hover:underline"
              >
                {mode === "login" ? "Cadastre-se" : "Faça login"}
              </button>
            </p>
          </div>
        </div>

        {/* Right: Feature panel */}
        <div className="bg-[#131313] p-10 md:p-12 flex flex-col justify-center border-l border-white/5">
          <h3 className="text-2xl font-extrabold text-white mb-2 font-[family-name:var(--font-lexend)]">
            Content-Driven{" "}
            <span className="bg-gradient-to-r from-[#ca98ff] to-[#e197fc] bg-clip-text text-transparent">Sales</span>
          </h3>
          <p className="text-[#adaaaa] text-sm leading-relaxed mb-8">
            Descubra quais conteúdos geram negócios no seu LinkedIn com inteligência artificial.
          </p>

          <div className="space-y-1 text-[0.65rem] font-bold tracking-[0.15em] text-white/30 uppercase mb-4">
            Incluso na análise
          </div>

          <div className="space-y-4">
            {[
              { icon: "🎯", label: "Análise de Decisores", desc: "Identifique quem são os decisores que engajam" },
              { icon: "🤝", label: "Prospecção de Influenciadores", desc: "Encontre creators relevantes do seu nicho" },
              { icon: "📊", label: "Revenue Engagement Rate", desc: "Métricas de engajamento que geram receita" },
              { icon: "📥", label: "Exportação de Leads", desc: "Exporte contatos qualificados em CSV" },
            ].map((feature) => (
              <div key={feature.label} className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{feature.icon}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{feature.label}</p>
                  <p className="text-[#adaaaa] text-xs">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center"><span className="text-[#adaaaa] animate-pulse">Carregando...</span></div>}>
      <AuthForm />
    </Suspense>
  );
}
