import type { Scope } from "@/lib/resource-access";

interface CountInput {
  count: number;
  sharedCount: number;
  scope: Scope;
  noun: string;
  feminine?: boolean;
}

function sharedAdj(plural: boolean, feminine: boolean): string {
  if (feminine) return plural ? "compartilhadas" : "compartilhada";
  return plural ? "compartilhados" : "compartilhado";
}

export function formatCountLabel({
  count,
  sharedCount,
  scope,
  noun,
  feminine = false,
}: CountInput): string {
  if (scope === "shared") {
    return `${noun} (${count} ${sharedAdj(count !== 1, feminine)})`;
  }
  if (scope === "mine") {
    const mine = feminine ? (count === 1 ? "minha" : "minhas") : (count === 1 ? "meu" : "meus");
    return `${noun} (${count} ${mine})`;
  }
  if (sharedCount > 0) {
    return `${noun} (${count} · ${sharedCount} ${sharedAdj(sharedCount !== 1, feminine)})`;
  }
  return `${noun} (${count})`;
}
