export function stripPhone(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

export function isValidBrPhone(digits: string): boolean {
  return /^\d{10,11}$/.test(digits);
}

export function formatBrPhone(raw: string): string {
  const d = stripPhone(raw).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
