"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReEnrichButton({ profileId }: { profileId: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  const loading = status !== null;

  async function handleClick() {
    try {
      console.log(`[re-enrich] Queuing re-enrich for profile ${profileId}`);
      setStatus("Queuing...");
      setResult(null);

      const queueRes = await fetch(`/api/profiles/${profileId}/re-enrich`, { method: "POST" });
      console.log(`[re-enrich] Queue response for ${profileId}: ${queueRes.status}`);

      if (!queueRes.ok) {
        setStatus(null);
        setResult("Failed to queue");
        return;
      }

      console.log(`[re-enrich] Triggering enrichment processing for ${profileId}`);
      setStatus("Enriching...");

      const processRes = await fetch("/api/enrichment/process", { method: "POST" });
      const processData = await processRes.json();
      console.log(`[re-enrich] Process response for ${profileId}:`, processData);

      const profileResult = processData.results?.find(
        (r: { profile_id: string }) => r.profile_id === profileId
      );
      const finalStatus = profileResult?.status === "done" ? "Done!" : profileResult ? "Failed" : "Done!";

      setStatus(null);
      setResult(finalStatus);
      router.refresh();

      setTimeout(() => setResult(null), 3000);
    } catch (err) {
      console.error(`[re-enrich] Error for profile ${profileId}:`, err);
      setStatus(null);
      setResult("Error");
      setTimeout(() => setResult(null), 3000);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status ?? "Re-enrich"}
      </button>
      {result && (
        <span className={`text-sm font-medium ${result.includes("Done") ? "text-green-600" : "text-red-600"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
