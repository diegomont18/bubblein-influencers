import { ImportForm } from "@/components/enricher/import-form";
import { QueueStatus } from "@/components/enricher/queue-status";
import { ProfileTable } from "@/components/enricher/profile-table";

export default function EnricherPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile Enricher</h1>
      <div className="grid grid-cols-2 gap-6">
        <ImportForm />
        <QueueStatus />
      </div>
      <ProfileTable />
    </div>
  );
}
