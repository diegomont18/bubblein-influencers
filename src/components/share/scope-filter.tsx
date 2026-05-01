"use client";

import type { Scope } from "@/lib/resource-access";

interface ScopeFilterProps {
  value: Scope;
  onChange: (next: Scope) => void;
  className?: string;
}

const OPTIONS: { value: Scope; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "mine", label: "Meus" },
  { value: "shared", label: "Compartilhados" },
];

export function ScopeFilter({ value, onChange, className }: ScopeFilterProps) {
  return (
    <div
      className={`inline-flex rounded-full border border-white/10 bg-white/[0.02] p-0.5 text-xs ${className ?? ""}`}
      role="tablist"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 rounded-full font-medium transition-colors font-[family-name:var(--font-lexend)] ${
              active
                ? "bg-[#ca98ff]/20 text-[#ca98ff]"
                : "text-[#adaaaa] hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
