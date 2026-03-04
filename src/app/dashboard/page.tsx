import { createServiceClient } from "@/lib/supabase/server";
import { ProcessQueueButton } from "@/components/enricher/process-queue-button";

export default async function DashboardPage() {
  const service = createServiceClient();

  const { data: profiles } = await service
    .from("profiles")
    .select("enrichment_status");

  const { data: jobs } = await service
    .from("enrichment_jobs")
    .select("status");

  const stats = { pending: 0, processing: 0, done: 0, failed: 0 };
  for (const p of profiles ?? []) {
    const s = p.enrichment_status as keyof typeof stats;
    if (s in stats) stats[s]++;
  }

  const totalJobs = jobs?.length ?? 0;

  const cards = [
    { label: "Pending", value: stats.pending, color: "bg-yellow-100 text-yellow-800" },
    { label: "Processing", value: stats.processing, color: "bg-blue-100 text-blue-800" },
    { label: "Done", value: stats.done, color: "bg-green-100 text-green-800" },
    { label: "Failed", value: stats.failed, color: "bg-red-100 text-red-800" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            {profiles?.length ?? 0} profiles, {totalJobs} enrichment jobs
          </p>
        </div>
        <ProcessQueueButton />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">
              {card.value}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${card.color}`}
            >
              {card.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
