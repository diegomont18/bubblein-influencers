"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReEnrichButton({ profileId }: { profileId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    await fetch(`/api/profiles/${profileId}/re-enrich`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      {loading ? "Queuing..." : "Re-enrich"}
    </button>
  );
}
