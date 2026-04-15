"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface UserInfo {
  email: string;
  role: string;
  credits: number;
}

const WHATSAPP_BUY_URL = "https://wa.me/5511941238555?text=Ola!%20Tenho%20interesse%20em%20comprar%20creditos%20no%20BubbleIn";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});

    // Listen for credit updates from child pages
    const handleCreditsUpdate = (e: Event) => {
      const credits = (e as CustomEvent).detail;
      setUser((prev) => prev ? { ...prev, credits } : prev);
    };
    window.addEventListener("credits-updated", handleCreditsUpdate);
    return () => window.removeEventListener("credits-updated", handleCreditsUpdate);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isAdmin = user?.role === "admin";
  const creditsDisplay =
    user?.credits === -1 ? "Ilimitado" : `${user?.credits ?? 0} créditos`;

  return (
    <div className="min-h-screen bg-[#0e0e0e] font-[family-name:var(--font-be-vietnam-pro)]">
      {/* Navbar */}
      <nav className="bg-[#131313]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/casting">
              <img src="/logo.png" alt="BubbleIn" width={120} height={43} />
            </Link>
            {isAdmin && (
              <Link
                href="/dashboard"
                className="text-xs font-semibold uppercase tracking-wider text-[#a2f31f] hover:text-[#95e400] transition-colors font-[family-name:var(--font-lexend)]"
              >
                Painel Admin
              </Link>
            )}
          </div>

          <div className="flex items-center gap-5">
            {user && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#262626] px-3 py-1 text-xs text-[#adaaaa] font-[family-name:var(--font-lexend)]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#a2f31f]" />
                  {creditsDisplay}
                </span>
                <a
                  href={WHATSAPP_BUY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-[#a2f31f]/30 bg-[#a2f31f]/10 px-3 py-1 text-xs font-semibold text-[#a2f31f] hover:bg-[#a2f31f]/20 transition-colors font-[family-name:var(--font-lexend)]"
                >
                  Comprar Créditos
                </a>
                <Link href="/casting/account" className="text-sm text-[#adaaaa] hover:text-white transition-colors">{user.email}</Link>
              </>
            )}
            <button
              onClick={handleSignOut}
              className="rounded-full bg-[#20201f] px-4 py-2 text-xs font-medium text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-colors font-[family-name:var(--font-lexend)]"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      {/* Content with sidebar */}
      <div className="max-w-7xl mx-auto px-6 py-12 flex gap-8">
        {/* Sidebar */}
        <aside className="w-44 shrink-0 hidden md:block">
          <nav className="space-y-1 sticky top-24">
            <Link
              href="/casting/leads-generation"
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors font-[family-name:var(--font-lexend)] ${
                pathname.startsWith("/casting/leads-generation") ? "bg-[#ca98ff]/10 text-[#ca98ff]" : "text-[#adaaaa] hover:text-white hover:bg-[#20201f]"
              }`}
            >
              Leads Generation
            </Link>
            <Link
              href="/casting"
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors font-[family-name:var(--font-lexend)] ${
                pathname === "/casting" ? "bg-[#ca98ff]/10 text-[#ca98ff]" : "text-[#adaaaa] hover:text-white hover:bg-[#20201f]"
              }`}
            >
              Influencers B2B
            </Link>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
